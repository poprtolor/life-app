"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { GymPage } from "./components/GymPage";
import { MuscleDetailPage } from "./components/MuscleDetailPage";
import { WorkoutCalendar } from "./components/WorkoutCalendar";
import { StreakCounter } from "./components/StreakCounter";
import { 
  loadGymData, 
  updateWorkoutHistory, 
  calculateCurrentStreak,
  type MuscleGroup,
  type GymData
} from "./utils/gymStorage";
import "./styles/gym.css";

// Main application component
export default function GymTrackerApp() {
  // State management
  const [currentPage, setCurrentPage] = useState<"habits" | "gym" | "school" | "university">("gym");
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [gymData, setGymData] = useState<GymData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = loadGymData();
        setGymData(data);
      } catch (error) {
        console.error("Error loading gym data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle muscle group selection
  const handleMuscleSelect = (muscle: MuscleGroup) => {
    setSelectedMuscle(muscle);
  };

  // Handle back navigation from muscle detail
  const handleBackToGym = () => {
    setSelectedMuscle(null);
  };

  // Handle workout day toggle in calendar
  const handleDayToggle = (date: string, status: "completed" | "missed" | "none") => {
    if (!gymData) return;

    const workedOut = status === "completed";
    const updatedData = updateWorkoutHistory(date, workedOut);
    setGymData(updatedData);
  };

  // Handle page navigation
  const handlePageChange = (page: typeof currentPage) => {
    setCurrentPage(page);
    // Reset muscle selection when navigating away from gym
    if (page !== "gym") {
      setSelectedMuscle(null);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-zinc-800 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-400">טוען את נתוני האימונים...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!gymData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">שגיאה בטעינת הנתונים</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  // Calculate current streak for sidebar
  const currentStreak = calculateCurrentStreak(gymData.workoutHistory);

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onPageChange={handlePageChange}
        currentStreak={currentStreak}
        totalWorkouts={gymData.totalWorkouts}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {currentPage === "gym" && (
          <>
            {selectedMuscle ? (
              <MuscleDetailPage
                muscle={selectedMuscle}
                onBack={handleBackToGym}
              />
            ) : (
              <div className="flex-1">
                <GymPage onMuscleSelect={handleMuscleSelect} />
                
                {/* Additional gym features below main page */}
                <div className="p-8 border-t border-zinc-800">
                  <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Calendar Section */}
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-6">לוח אימונים</h2>
                        <WorkoutCalendar
                          workoutHistory={gymData.workoutHistory}
                          onDayToggle={handleDayToggle}
                        />
                      </div>

                      {/* Streak Counter Section */}
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-6">רצף אימונים</h2>
                        <StreakCounter
                          workoutHistory={gymData.workoutHistory}
                          onStreakUpdate={(streak) => {
                            // Update local state when streak changes
                            setGymData(prev => prev ? { ...prev, currentStreak: streak } : null);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Placeholder pages for other sections */}
        {currentPage === "habits" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">הרגלים</h2>
              <p className="text-zinc-400">דף הרגלים יבוא בקרוב...</p>
            </div>
          </div>
        )}

        {currentPage === "school" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">בית ספר</h2>
              <p className="text-zinc-400">דף בית הספר יבוא בקרוב...</p>
            </div>
          </div>
        )}

        {currentPage === "university" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">אוניברסיטה</h2>
              <p className="text-zinc-400">דף אוניברסיטה יבוא בקרוב...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
