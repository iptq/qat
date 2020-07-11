import { Document, Model } from 'mongoose'
import { IUserDocument } from './user';
import { ITestSubmissionDocument } from './testSubmission';
import { IReviewDocument } from './review';

interface IEvaluationBase {
    user: IUserDocument;
    mode: string;
    reviews?: IReviewDocument[];
    active?: boolean;
    discussion?: boolean;
    feedback?: string;
    cooldownDate?: Date;
    natEvaluators?: IUserDocument[];
    consensusSetAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IAppEvaluationDocument extends IEvaluationBase, Document {
    consensus?: string;
    bnEvaluators?: IUserDocument[];
    mods: string[];
    reasons: string[];
    test?: ITestSubmissionDocument;
    deadline?: Date;
    kind?: string;
}

export interface IAppEvaluationModel extends Model<IAppEvaluationDocument> {
    findActiveApps?: () => Promise<IAppEvaluationDocument[]>;
}

export interface IBnEvaluationDocument extends IEvaluationBase, Document {
    consensus?: string;
    deadline?: Date;
    isLowActivity?: boolean;
    resignedOnGoodTerms?: boolean;
    resignedOnStandardTerms?: boolean;
    isMoveToNat?: boolean;
    isMoveToBn?: boolean;
    kind?: string;
}

export interface IBnEvaluationModel extends Model<IBnEvaluationDocument> {
    findActiveEvaluations?: () => Promise<IBnEvaluationDocument[]>;
    deleteUserActiveEvaluations?: (userId: number) => Promise<{ ok: number, deletedCount: number, n: number }>;
}