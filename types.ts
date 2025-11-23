export enum Difficulty {
  Easy = "Easy",
  Medium = "Medium",
  Hard = "Hard"
}

export enum ClueType {
  Observation = "Observation",
  Testimony = "Testimony",
  Physical = "Physical Object",
  Context = "Context"
}

export interface Clue {
  id: number;
  text: string;
  type: ClueType;
  isRedHerring: boolean;
}

export interface Option {
  id: string;
  text: string;
}

export interface MysteryCase {
  title: string;
  scenario: string;
  difficulty: Difficulty;
  clues: Clue[];
  options: Option[];
  correctOptionId: string;
  explanation: string;
}

export interface User {
  username: string;
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  casesSolved: number;
  totalXp: number;
}

export enum GameState {
  Auth = "Auth",
  Idle = "Idle",
  Loading = "Loading",
  Playing = "Playing",
  Solving = "Solving",
  Success = "Success",
  Failure = "Failure",
  Error = "Error"
}