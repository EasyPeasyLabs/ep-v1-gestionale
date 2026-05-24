export interface CampaignRecipient {
    id: string;
    name: string;
    contact: string;
    type: 'client' | 'lead';
}

export interface Campaign {
    id: string;
    name: string;
    channel: 'email' | 'whatsapp';
    subject: string;
    message: string;
    mediaLinks: string;
    recipients: CampaignRecipient[];
    startDate: string;
    time: string;
    frequency: 'once' | 'daily' | 'weekly' | 'monthly';
    repeatCount: number;
    status: 'active' | 'completed' | 'paused';
    sentCount: number;
    nextRun: string;
}

export type CampaignInput = Omit<Campaign, 'id'>;

export interface CommunicationLog {
    id: string;
    date: string;
    channel: 'email' | 'whatsapp';
    subject: string;
    message: string;
    recipients: string[];
    recipientCount: number;
    type: 'manual' | 'campaign';
}

export type CommunicationLogInput = Omit<CommunicationLog, 'id'>;
