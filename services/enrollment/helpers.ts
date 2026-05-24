
import { Appointment, Course } from '../../types';
import { isItalianHoliday } from '../../utils/dateUtils';

/**
 * Genera un calendario teorico di appuntamenti basato su ricorrenza settimanale.
 * Gestisce festività e combo LAB+SG.
 */
export const generateTheoreticalAppointments = (
    startDate: string,
    totalLessons: number,
    locationId: string,
    locationName: string,
    locationColor: string,
    startTime: string,
    endTime: string,
    childName: string,
    comboConfigs?: Course['comboConfigs'],
    weeklyPlan?: Record<number, string>,
    courseStartDate?: string,
    targetDayOfWeek?: number
): Appointment[] => {
    const appointments: Appointment[] = [];
    const startObj = new Date(startDate);
    startObj.setHours(12, 0, 0, 0);
    
    const current = new Date(startObj);
    
    if (targetDayOfWeek !== undefined) {
        while (current.getDay() !== targetDayOfWeek) {
            current.setDate(current.getDate() + 1);
        }
    }
    
    let loops = 0; 
    let count = 0;
    
    while (count < totalLessons && loops < 100) {
        if (!isItalianHoliday(current)) {
            let sTime = startTime;
            let eTime = endTime;
            let aType = 'LAB';

            if (comboConfigs && comboConfigs.LAB && comboConfigs.SG && weeklyPlan) {
                const referenceDate = new Date(courseStartDate || startDate);
                referenceDate.setHours(12, 0, 0, 0);
                const msPerWeek = 7 * 24 * 60 * 60 * 1000;
                const weeksSinceStart = Math.floor(
                    (current.getTime() - referenceDate.getTime()) / msPerWeek
                );
                const planSize = Object.keys(weeklyPlan).length || 4;
                const weekNum = (weeksSinceStart % planSize) + 1;
                const plannedType = weeklyPlan[weekNum] || 'LAB';

                if (plannedType === 'LAB') {
                    sTime = comboConfigs.LAB.startTime;
                    eTime = comboConfigs.LAB.endTime;
                    aType = 'LAB';
                } else {
                    sTime = comboConfigs.SG.startTime;
                    eTime = comboConfigs.SG.endTime;
                    aType = 'SG';
                }
            }

            appointments.push({
                lessonId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                date: current.toISOString(),
                startTime: sTime,
                endTime: eTime,
                locationId: locationId,
                locationName: locationName,
                locationColor: locationColor,
                childName: childName,
                status: 'Scheduled',
                type: aType
            });
            count++;
        }
        current.setDate(current.getDate() + 7);
        loops++;
    }
    return appointments;
};
