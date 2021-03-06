import { Document, Model } from 'mongoose'
import { IUserDocument } from './user';

interface IReportDocument extends Document {
    reporter: IUserDocument;
    culprit: IUserDocument;
    link: string;
    reason: string;
    valid: number;
    feedback: string;
    isActive: boolean;
}

export default interface IReportModel extends Model<IReportDocument> { }
