import type { ActivityLevel, Goal } from "@/lib/types";

export type ActivityLevelOption = {
  value: ActivityLevel;
  label: string;
  frequency: string;
  description: string;
};

export type GoalOption = {
  value: Goal;
  label: string;
  pacing: string;
  description: string;
};

export const ACTIVITY_LEVEL_OPTIONS: ActivityLevelOption[] = [
  {
    value: "sedentary",
    label: "Sedentary",
    frequency: "Little to no exercise",
    description: "Desk work or studying most of the day with minimal structured workouts.",
  },
  {
    value: "light",
    label: "Lightly Active",
    frequency: "1–3 days / week",
    description: "Light workouts, brisk daily walks, or casual sports a couple of days a week.",
  },
  {
    value: "moderate",
    label: "Moderately Active",
    frequency: "3–5 days / week",
    description: "Consistent gym sessions, running, or active training most weekdays.",
  },
  {
    value: "active",
    label: "Active",
    frequency: "6–7 days / week",
    description: "Vigorous workouts or structured athletic training almost every day.",
  },
  {
    value: "very_active",
    label: "Very Active",
    frequency: "Intense daily",
    description: "Physically demanding job plus daily training, or twice-a-day workouts.",
  },
];

export const GOAL_OPTIONS: GoalOption[] = [
  {
    value: "lose",
    label: "Lose Weight",
    pacing: "−500 kcal/day",
    description: "Steady, sustainable calorie deficit for gradual fat loss.",
  },
  {
    value: "maintain",
    label: "Maintain Weight",
    pacing: "Balanced",
    description: "Match your daily energy expenditure to stay at your current weight.",
  },
  {
    value: "gain",
    label: "Gain Weight",
    pacing: "+500 kcal/day",
    description: "Controlled calorie surplus to support strength and lean muscle.",
  },
];
