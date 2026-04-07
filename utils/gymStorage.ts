// LocalStorage utility functions for gym data management
// This file handles all data persistence operations

// Types for gym data structure
export type MuscleGroup = "chest" | "back" | "shoulders" | "arms" | "legs";

export interface WorkoutSession {
  id: string;
  date: string;
  duration: number; // minutes
  exercises: string[];
  notes?: string;
  muscleGroups: MuscleGroup[];
}

export interface MuscleData {
  name: string;
  nameHebrew: string;
  progress: number;
  workouts: number;
  lastWorkout: string;
  personalRecord?: number; // kg
}

export interface GymData {
  muscles: Record<MuscleGroup, MuscleData>;
  workoutHistory: Record<string, boolean>; // date -> workedOut
  workoutSessions: WorkoutSession[];
  currentStreak: number;
  totalWorkouts: number;
  settings: {
    weeklyGoal: number;
    notificationsEnabled: boolean;
  };
}

// Default data structure
const defaultGymData: GymData = {
  muscles: {
    chest: {
      name: "chest",
      nameHebrew: "חזה",
      progress: 0,
      workouts: 0,
      lastWorkout: "",
      personalRecord: undefined
    },
    back: {
      name: "back",
      nameHebrew: "גב",
      progress: 0,
      workouts: 0,
      lastWorkout: "",
      personalRecord: undefined
    },
    shoulders: {
      name: "shoulders",
      nameHebrew: "כתפיים",
      progress: 0,
      workouts: 0,
      lastWorkout: "",
      personalRecord: undefined
    },
    arms: {
      name: "arms",
      nameHebrew: "זרועות",
      progress: 0,
      workouts: 0,
      lastWorkout: "",
      personalRecord: undefined
    },
    legs: {
      name: "legs",
      nameHebrew: "רגליים",
      progress: 0,
      workouts: 0,
      lastWorkout: "",
      personalRecord: undefined
    }
  },
  workoutHistory: {},
  workoutSessions: [],
  currentStreak: 0,
  totalWorkouts: 0,
  settings: {
    weeklyGoal: 5,
    notificationsEnabled: true
  }
};

// Storage key
const STORAGE_KEY = 'gymTrackerData';

/**
 * Load gym data from localStorage
 * @returns GymData object or default data if nothing is stored
 */
export const loadGymData = (): GymData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultGymData;
    }
    
    const parsed = JSON.parse(stored);
    
    // Merge with default data to ensure all properties exist
    return {
      ...defaultGymData,
      ...parsed,
      muscles: {
        ...defaultGymData.muscles,
        ...parsed.muscles
      },
      settings: {
        ...defaultGymData.settings,
        ...parsed.settings
      }
    };
  } catch (error) {
    console.error('Error loading gym data:', error);
    return defaultGymData;
  }
};

/**
 * Save gym data to localStorage
 * @param data - GymData object to save
 */
export const saveGymData = (data: GymData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving gym data:', error);
  }
};

/**
 * Update workout history for a specific date
 * @param date - Date string in YYYY-MM-DD format
 * @param workedOut - Whether workout was completed
 */
export const updateWorkoutHistory = (date: string, workedOut: boolean): GymData => {
  const currentData = loadGymData();
  
  if (workedOut) {
    currentData.workoutHistory[date] = true;
    currentData.totalWorkouts += 1;
  } else {
    delete currentData.workoutHistory[date];
    currentData.totalWorkouts = Math.max(0, currentData.totalWorkouts - 1);
  }
  
  // Update streak
  currentData.currentStreak = calculateCurrentStreak(currentData.workoutHistory);
  
  saveGymData(currentData);
  return currentData;
};

/**
 * Add a new workout session
 * @param session - Workout session data
 */
export const addWorkoutSession = (session: Omit<WorkoutSession, 'id'>): GymData => {
  const currentData = loadGymData();
  
  const newSession: WorkoutSession = {
    ...session,
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  
  currentData.workoutSessions.push(newSession);
  
  // Update muscle group data
  session.muscleGroups.forEach(muscle => {
    if (currentData.muscles[muscle]) {
      currentData.muscles[muscle].workouts += 1;
      currentData.muscles[muscle].lastWorkout = session.date;
      currentData.muscles[muscle].progress = Math.min(100, 
        currentData.muscles[muscle].progress + 5
      );
    }
  });
  
  // Update workout history
  currentData.workoutHistory[session.date] = true;
  currentData.totalWorkouts += 1;
  currentData.currentStreak = calculateCurrentStreak(currentData.workoutHistory);
  
  saveGymData(currentData);
  return currentData;
};

/**
 * Delete a workout session
 * @param sessionId - ID of the session to delete
 */
export const deleteWorkoutSession = (sessionId: string): GymData => {
  const currentData = loadGymData();
  
  const sessionIndex = currentData.workoutSessions.findIndex(s => s.id === sessionId);
  if (sessionIndex === -1) return currentData;
  
  const session = currentData.workoutSessions[sessionIndex];
  
  // Remove session
  currentData.workoutSessions.splice(sessionIndex, 1);
  
  // Update muscle group data
  session.muscleGroups.forEach(muscle => {
    if (currentData.muscles[muscle]) {
      currentData.muscles[muscle].workouts = Math.max(0, 
        currentData.muscles[muscle].workouts - 1
      );
      currentData.muscles[muscle].progress = Math.max(0, 
        currentData.muscles[muscle].progress - 5
      );
    }
  });
  
  // Check if this was the only workout for this date
  const otherSessionsSameDate = currentData.workoutSessions.some(
    s => s.date === session.date && s.id !== sessionId
  );
  
  if (!otherSessionsSameDate) {
    delete currentData.workoutHistory[session.date];
    currentData.totalWorkouts = Math.max(0, currentData.totalWorkouts - 1);
    currentData.currentStreak = calculateCurrentStreak(currentData.workoutHistory);
  }
  
  saveGymData(currentData);
  return currentData;
};

/**
 * Update personal record for a muscle group
 * @param muscle - Muscle group
 * @param weight - New personal record weight in kg
 */
export const updatePersonalRecord = (muscle: MuscleGroup, weight: number): GymData => {
  const currentData = loadGymData();
  
  if (currentData.muscles[muscle]) {
    const currentPR = currentData.muscles[muscle].personalRecord || 0;
    if (weight > currentPR) {
      currentData.muscles[muscle].personalRecord = weight;
      saveGymData(currentData);
    }
  }
  
  return currentData;
};

/**
 * Get workout sessions for a specific muscle group
 * @param muscle - Muscle group
 * @returns Array of workout sessions
 */
export const getMuscleWorkouts = (muscle: MuscleGroup): WorkoutSession[] => {
  const currentData = loadGymData();
  return currentData.workoutSessions.filter(session => 
    session.muscleGroups.includes(muscle)
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

/**
 * Get workout sessions for a date range
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Array of workout sessions
 */
export const getWorkoutsInDateRange = (
  startDate: string, 
  endDate: string
): WorkoutSession[] => {
  const currentData = loadGymData();
  return currentData.workoutSessions.filter(session => 
    session.date >= startDate && session.date <= endDate
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

/**
 * Calculate statistics for a given period
 * @param days - Number of days to look back
 * @returns Statistics object
 */
export const getWorkoutStats = (days: number = 30) => {
  const currentData = loadGymData();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffDateString = cutoffDate.toISOString().split('T')[0];
  
  const recentSessions = currentData.workoutSessions.filter(
    session => session.date >= cutoffDateString
  );
  
  const totalMinutes = recentSessions.reduce((sum, session) => sum + session.duration, 0);
  const avgDuration = recentSessions.length > 0 ? totalMinutes / recentSessions.length : 0;
  
  // Count workouts per muscle group
  const muscleCounts: Record<MuscleGroup, number> = {
    chest: 0,
    back: 0,
    shoulders: 0,
    arms: 0,
    legs: 0
  };
  
  recentSessions.forEach(session => {
    session.muscleGroups.forEach(muscle => {
      muscleCounts[muscle]++;
    });
  });
  
  return {
    totalWorkouts: recentSessions.length,
    totalMinutes,
    avgDuration: Math.round(avgDuration),
    muscleCounts,
    currentStreak: currentData.currentStreak,
    longestStreak: calculateLongestStreak(currentData.workoutHistory)
  };
};

/**
 * Calculate current streak from workout history
 * @param workoutHistory - Record of workout dates
 * @returns Current streak in days
 */
export const calculateCurrentStreak = (workoutHistory: Record<string, boolean>): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let streak = 0;
  let currentDate = new Date(today);
  
  // Check if today was a workout day, if not, start from yesterday
  const todayString = currentDate.toISOString().split('T')[0];
  if (!workoutHistory[todayString]) {
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  // Count consecutive workout days going backwards
  while (true) {
    const dateString = currentDate.toISOString().split('T')[0];
    
    if (workoutHistory[dateString] === true) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
};

/**
 * Calculate longest streak from workout history
 * @param workoutHistory - Record of workout dates
 * @returns Longest streak in days
 */
export const calculateLongestStreak = (workoutHistory: Record<string, boolean>): number => {
  const sortedDates = Object.keys(workoutHistory)
    .filter(date => workoutHistory[date] === true)
    .sort();
  
  let longestStreak = 0;
  let currentStreak = 0;
  let lastDate: Date | null = null;
  
  for (const dateString of sortedDates) {
    const currentDate = new Date(dateString);
    
    if (lastDate) {
      const daysDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        currentStreak++;
      } else {
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
      }
    } else {
      currentStreak = 1;
    }
    
    lastDate = currentDate;
  }
  
  longestStreak = Math.max(longestStreak, currentStreak);
  return longestStreak;
};

/**
 * Export data for backup
 * @returns JSON string of all gym data
 */
export const exportData = (): string => {
  const data = loadGymData();
  return JSON.stringify(data, null, 2);
};

/**
 * Import data from backup
 * @param jsonData - JSON string of gym data
 * @returns Success status
 */
export const importData = (jsonData: string): boolean => {
  try {
    const data = JSON.parse(jsonData);
    
    // Validate data structure
    if (!data.muscles || !data.workoutHistory || !data.workoutSessions) {
      throw new Error('Invalid data structure');
    }
    
    saveGymData(data);
    return true;
  } catch (error) {
    console.error('Error importing data:', error);
    return false;
  }
};

/**
 * Clear all gym data
 */
export const clearAllData = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing data:', error);
  }
};
