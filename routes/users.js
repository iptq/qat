const express = require('express');
const api = require('../helpers/api');
const usersService = require('../models/user').service;
const logsService = require('../models/log').service;
const bnAppsService = require('../models/bnApp').service;
const evalRoundsService = require('../models/evalRound').service;
const aiessService = require('../models/aiess').service;
const notesService = require('../models/note').service;

const router = express.Router();

router.use(api.isLoggedIn);

const defaultNotePopulate = [
    { populate: 'author', display: 'username osuId' },
    { populate: 'user', display: 'username osuId' },
];

const evaluationsPopulate = [
    {
        populate: 'evaluations',
        display: 'evaluator',
    },
];

const appPopulate = [
    { populate: 'applicant', display: 'username osuId' },
    { populate: 'bnEvaluators', display: 'username osuId' },
    { populate: 'test', display: 'totalScore' },
    {
        populate: 'evaluations',
        display: 'evaluator behaviorComment moddingComment vote',
    },
    {
        innerPopulate: 'evaluations',
        populate: { path: 'evaluator', select: 'username osuId group' },
    },
];

/* GET bn app page */
router.get('/', (req, res) => {
    res.render('users', {
        title: 'BN/NAT Listing',
        script: '../javascripts/users.js',
        isUsers: true,
        isBn: res.locals.userRequest.isBn,
        isNat: res.locals.userRequest.isNat || res.locals.userRequest.isSpectator,
    });
});

/* GET applicant listing. */
router.get('/relevantInfo', async (req, res) => {
    let u = await usersService.query(
        { $or: [{ group: 'nat' }, { group: 'bn' }] },
        {},
        { username: 1 },
        true
    );
    res.json({ 
        users: u, 
        userId: req.session.mongoId, 
        isLeader: res.locals.userRequest.isLeader, 
        isNat: res.locals.userRequest.group == 'nat' || res.locals.userRequest.isSpectator, 
        isBn: res.locals.userRequest.group == 'bn', 
    });
});

/* POST switch bn evaluator */
router.post('/switchBnEvaluator/', api.isBnOrNat, async (req, res) => {
    let u = await usersService.update(req.session.mongoId, {
        isBnEvaluator: !res.locals.userRequest.isBnEvaluator,
    });
    res.json(u);
    logsService.create(req.session.mongoId, `Opted ${u.isBnEvaluator ? 'in to' : 'out of'} optional BN app evaluation input`);
});

/* POST switch usergroup */
router.post('/switchGroup/:id', api.isLeader, async (req, res) => {
    let u = await usersService.update(req.params.id, { group: req.body.group,  probation: [], $push: { bnDuration: new Date(), natDuration: new Date() } });
    res.json(u);
    logsService.create(
        req.session.mongoId,
        `Changed usergroup of "${u.username}" to "${req.body.group.toUpperCase()}"`
    );
});

/* POST remove from BN/NAT without evaluation */
router.post('/removeNat/:id', api.isLeader, async (req, res) => {
    let u = await usersService.update(req.params.id, { group: 'user',  probation: [], modes: [], $push: { natDuration: new Date() } });
    res.json(u);
    logsService.create(
        req.session.mongoId,
        `Removed "${u.username}" from the NAT`
    );
});

/* GET user notes */
router.get('/loadUserNotes/:id', api.isNat, async (req, res) => {
    let notes = await notesService.query(
        { user: req.params.id, isHidden: { $ne: true } },
        defaultNotePopulate,
        { createdAt: -1 },
        true
    );
    res.json(notes);
});

/* POST save note */
router.post('/saveNote/:id', api.isNat, async (req, res) => {
    let note = await notesService.create(
        req.session.mongoId,
        req.params.id,
        req.body.comment
    );
    note = await notesService.query({ _id: note._id }, defaultNotePopulate);
    res.json(note);
    let u = await usersService.query({ _id: req.params.id });
    logsService.create(
        req.session.mongoId,
        `Added user note to "${u.username}"`
    );
    api.webhookPost(
        [{
            author: {
                name: `${note.author.username}`,
                icon_url: `https://a.ppy.sh/${note.author.osuId}`,
                url: `https://osu.ppy.sh/users/${note.author.osuId}`,
            },
            color: '7952450',
            fields:[
                {
                    name: `http://bn.mappersguild.com/users?id=${note.user.id}`,
                    value: `Added note to **${note.user.username}**'s profile`,
                },
                {
                    name: 'Note',
                    value: req.body.comment.length > 975 ? req.body.comment.slice(0,975) + '... *(truncated)*' : req.body.comment,
                },
            ],
        }], 
        u.modes[0]
    );
});

/* POST hide note */
router.post('/hideNote/:id', api.isNat, async (req, res) => {
    await notesService.update(req.params.id, { isHidden: true } );
    res.json({});
    let u = await usersService.query({ _id: req.body.userId });
    logsService.create(
        req.session.mongoId,
        `Removed user note from "${u.username}"`
    );
});

/* POST edit note */
router.post('/editNote/:id', api.isNat, async (req, res) => {
    await notesService.update(req.params.id, { comment: req.body.comment } );
    let n = await notesService.query({ _id: req.params.id }, defaultNotePopulate);
    res.json(n);
    let u = await usersService.query({ _id: n.user });
    logsService.create(
        req.session.mongoId,
        `edited user note for "${u.username}"`
    );
});

/* GET all users with badge info */
router.get('/findUserBadgeInfo', async (req, res) => {
    let u = await usersService.query(
        { $or: [{ 'bnDuration.0': { $exists: true } }, { 'natDuration.0': { $exists: true } }] },
        {},
        { username: 1 },
        true
    );
    res.json(u);
});

/* POST edit badge value */
router.post('/editBadgeValue/:id', api.isLeader, async (req, res) => {
    let u = await usersService.query({ _id: req.params.id });
    if(res.locals.userRequest.osuId == '3178418'){ //i dont want anyone else messing with this
        let years;
        let num = req.body.add ? 1 : -1;
        if(req.body.group == 'bn'){
            years = u.bnProfileBadge + num;
            await usersService.update(req.params.id, { bnProfileBadge: years });
        }else{
            years = u.natProfileBadge + num;
            await usersService.update(req.params.id, { natProfileBadge: years });
        }
    }
    u = await usersService.query({ _id: req.params.id });
    res.json(u);
});

router.get('/findNatActivity/:days/:mode', async (req, res) => {
    let minAppDate = new Date();
    minAppDate.setDate(minAppDate.getDate() - (parseInt(req.params.days) + 14));
    let minEvalDate = new Date();
    minEvalDate.setDate(minEvalDate.getDate() - (parseInt(req.params.days)));
    let maxDate = new Date();
    const [users, bnApps, bnRounds] = await Promise.all([
        usersService.query({ 
            group: 'nat', 
            modes: req.params.mode,
            isSpectator: { $ne: true } },
        {}, { username: 1 }, true),
        bnAppsService.query({ mode: req.params.mode, createdAt: { $gte: minAppDate, $lte: maxDate }, discussion: true }, evaluationsPopulate, {}, true),
        evalRoundsService.query({ mode: req.params.mode, deadline: { $gte: minEvalDate, $lte: maxDate }, discussion: true }, evaluationsPopulate, {}, true),
    ]);
    let bnAppsCount = bnApps.length;
    let evalRoundsCount = bnRounds.length;
    const invalids = [8129817, 3178418];
    let info = [];
    users.forEach(user => {
        if(invalids.indexOf(user.osuId) == -1){
            let evalsOnBnApps = 0;
            let evalsOnCurrentBnEvals = 0;
            let feedbackCount = 0;
            bnApps.forEach(app => {
                app.evaluations.forEach(evaluation => {
                    if(evaluation.evaluator == user.id){
                        evalsOnBnApps++;
                    }    
                });
                if(app.feedbackAuthor == user.id){
                    feedbackCount++;
                }
            });
            bnRounds.forEach(round => {
                round.evaluations.forEach(evaluation => {
                    if(evaluation.evaluator == user.id){
                        evalsOnCurrentBnEvals++;
                    }    
                });
                if(round.feedbackAuthor == user.id){
                    feedbackCount++;
                }
            });
            info.push({ 
                username: user.username, 
                osuId: user.osuId, 
                totalBnAppEvals: evalsOnBnApps, 
                totalCurrentBnEvals: evalsOnCurrentBnEvals, 
                totalWrittenFeedbacks: feedbackCount, 
                joinDate: user.natDuration[user.natDuration.length - 1],
            });
        }
    });

    res.json({ info, bnAppsCount, evalRoundsCount });
});

router.get('/findBnActivity/:days/:mode', async (req, res) => {
    let minDate = new Date();
    minDate.setDate(minDate.getDate() - parseInt(req.params.days));
    let maxDate = new Date();
    const [users, allEvents] = await Promise.all([
        usersService.query({ 
            group: 'bn', 
            modes: req.params.mode,
            isSpectator: { $ne: true } },
        {}, { username: 1 }, true),
        aiessService.getAllActivity(minDate, maxDate, req.params.mode),
    ]);

    let info = [];
    users.forEach(user => {
        let uniqueNominations = [];
        let nominationResets = 0;
        for (let i = 0; i < allEvents.length; i++) {
            const eventType = allEvents[i]._id;
            const events = allEvents[i].events;
    
            if (eventType == 'Bubbled' || eventType == 'Qualified') {
                for (let j = 0; j < events.length; j++) {
                    let event = events[j];
                    if(event.userId == user.osuId){
                        if (uniqueNominations.length == 0) {
                            uniqueNominations.push(events);
                        } else if (!uniqueNominations.find(n => n.beatmapsetId == event.beatmapsetId)) {
                            uniqueNominations.push(event);
                        }
                    }
                }
            } else if (eventType == 'Popped' || eventType == 'Disqualified') {
                for (let j = 0; j < events.length; j++) {
                    if(events[j].userId == user.osuId){
                        nominationResets++;
                    }
                }
            }
        }
        info.push({ 
            username: user.username, 
            osuId: user.osuId, 
            uniqueNominations: uniqueNominations.length, 
            nominationResets, 
            joinDate: user.bnDuration[user.bnDuration.length - 1],
        });
    });

    res.json(info);
});

/* GET potential NAT info */
router.get('/findPotentialNatInfo/', async (req, res) => {
    const [users, applications] = await Promise.all([
        usersService.query({ 
            group: 'bn', 
            isSpectator: { $ne: true },
            isBnEvaluator: true }, 
        {}, { username: 1 }, true),
        bnAppsService.query({ bnEvaluators: { $exists: true, $not: { $size: 0 } }, active: false }, appPopulate, {}, true),
    ]);

    let info = [];
    users.forEach(user => {
        let evaluatedApps = [];
        applications.forEach(app => {
            app.evaluations.forEach(evaluation => {
                if(evaluation.evaluator.id == user.id){
                    evaluatedApps.push(app);
                }
            });
        });
        info.push({ username: user.username, osuId: user.osuId, modes: user.modes, evaluatedApps });
    });

    res.json(info);
});

module.exports = router;
