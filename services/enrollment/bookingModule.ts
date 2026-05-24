
import { db } from '../../firebase/config';
import { 
    collection, 
    getDocs, 
    doc, 
    query, 
    where, 
    writeBatch, 
    arrayUnion 
} from 'firebase/firestore';
import { Lesson, LessonAttendee } from '../../types';

export const bookStudentIntoCourseLessons = async (
    enrollmentId: string,
    courseId: string,
    clientId: string,
    childId: string,
    childName: string,
    startDate: string,
    totalLessons: number,
    quotas?: Record<string, number>
) => {
    const lessonsRef = collection(db, 'lessons');
    const q = query(
        lessonsRef,
        where('courseId', '==', courseId)
    );
    const snap = await getDocs(q);
    
    const lessons = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Lesson))
        .filter(l => {
            const cleanLDate = l.date.split('T')[0];
            const cleanSDate = startDate.split('T')[0];
            return cleanLDate >= cleanSDate;
        })
        .sort((a, b) => a.date.localeCompare(b.date));

    const batch = writeBatch(db);
    let bookedCount = 0;
    const tokenUsage: Record<string, number> = {};
    let finalEndDate = startDate;

    const attendee: LessonAttendee = {
        clientId,
        childId,
        childName,
        enrollmentId,
        status: 'Scheduled'
    };

    for (const lesson of lessons) {
        if (bookedCount >= totalLessons) break;

        const type = lesson.slotType || 'LAB';
        const currentUsage = tokenUsage[type] || 0;

        if (quotas && quotas[type] !== undefined) {
            if (currentUsage >= quotas[type]) continue;
        }

        const lessonDocRef = doc(db, 'lessons', lesson.id);
        const isAlreadyBooked = (lesson.attendees || []).some(a => a.enrollmentId === enrollmentId);
        
        if (isAlreadyBooked) continue;
        
        lesson.attendees = [...(lesson.attendees || []), attendee];

        batch.update(lessonDocRef, {
            attendees: arrayUnion(attendee)
        });

        tokenUsage[type] = currentUsage + 1;
        bookedCount++;
        finalEndDate = lesson.date;
    }

    if (bookedCount > 0) {
        await batch.commit();
    }

    const bookedLessons = lessons.filter(l => 
        (l.attendees || []).some(a => a.enrollmentId === enrollmentId)
    );

    return { 
        bookedCount, 
        tokenUsage, 
        finalEndDate,
        bookedLessons
    };
};
