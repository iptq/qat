<template>
    <div class="row align-items-center" style="min-height: 30px">
        <div class="col-sm-8">
            <a
                class="ml-2"
                :href="`https://osu.ppy.sh/beatmapsets/${request.beatmapset.osuId}`"
                target="_blank"
            >
                {{ request.beatmapset.fullTitle }}
            </a>
        </div>
        <div class="col-sm-4 d-flex justify-content-around">
            <div>
                <request-tag>
                    {{ request.category }}
                </request-tag>
            </div>
            <div>
                <span :title="request.createdAt">
                    {{ $moment(request.createdAt).fromNow() }}
                </span>
            </div>
            <div :class="getStatusClass(request.modReviews)">
                {{ getStatus(request.modReviews) }}
            </div>
            <div class="d-flex justify-content-end align-items-center">
                <a
                    href="#"
                    data-toggle="modal"
                    data-target="#editRequestModal"
                    @click.prevent="$store.commit('modRequests/updateEditingRequestId', request.id)"
                >
                    <i class="fas fa-ellipsis-v px-3" />
                </a>
            </div>
        </div>
        <div v-if="request.modReviews.length" class="col-sm-12">
            <div v-for="review in request.modReviews" :key="review._id" class="ml-2 text-secondary">
                <user-link
                    :osu-id="review.user.osuId"
                    :username="review.user.username"
                />
                <span :class="review.action == 'accepted' ? 'text-success' : 'text-warning'">
                    ({{ review.action }})
                </span>
                - {{ review.comment }}
            </div>
        </div>
    </div>
</template>

<script>
import RequestTag from './RequestTag.vue';
import UserLink from '../UserLink.vue';

export default {
    name: 'MyRequestRow',
    components: {
        RequestTag,
        UserLink,
    },
    props: {
        request: {
            type: Object,
            required: true,
        },
    },
    methods: {
        getStatus (reviews) {
            if (reviews.find(r => r.action === 'accepted')) return 'Accepted';

            let n_denied = reviews.filter(r => r.action === 'denied').length;
            if (n_denied > 0) return `Denied by ${n_denied}`;

            return 'Pending';
        },
        getStatusClass (reviews) {
            if (reviews.find(r => r.action === 'accepted')) return 'text-success';
            if (reviews.find(r => r.action === 'denied')) return 'text-warning';

            return '';
        },
    },
};
</script>
