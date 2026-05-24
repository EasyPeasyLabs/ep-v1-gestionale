export interface Activity {
    id: string;
    title: string;
    category: string;
    theme: string;
    description: string;
    materials: string;
    links: string;
    attachments: string[];
    createdAt: string;
}

export type ActivityInput = Omit<Activity, 'id'>;

export interface LessonActivity {
    id: string;
    lessonId: string;
    activityIds: string[];
    date: string;
}
