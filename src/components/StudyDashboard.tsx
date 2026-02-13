import { useState } from 'react';
import { TeacherCalendar } from './TeacherCalendar';

interface StudyDashboardProps {
  user: any;
  isDarkMode?: boolean;
}

export function StudyDashboard({ user, isDarkMode = false }: StudyDashboardProps) {
  // Load subjects for calendar (minimal data needed)
  const [subjects] = useState<any[]>([]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pb-32 sm:pb-36 pt-4 sm:pt-6">
      <TeacherCalendar user={user} subjects={subjects} isDarkMode={isDarkMode} />
    </div>
  );
}
