import { writeFile } from "fs";
import { Assignment } from "../csp/csp.js";
import { getSunTime, TIME, zenith } from "../util/math.js";
import { ActivityType } from "./task.js";
import { DAY_START_TIME, Duration, inHours, isBefore, Timing } from "./time.js";

const pause_weight = 1.0;
const gym_weight = 1.0;
const outdoor_weight = 1.0;
const deep_work_weight = 1.0;

export function getPauseTime(scheudle: Assignment[]) {
  const pauses: Duration[] = [];

  if (scheudle.length == 1) return [];

  let a = scheudle[0].end;
  let b = scheudle[1].start;

  pauses.push(Timing.diff(b, a));

  for (let index = 2; index < scheudle.length; index++) {
    a = scheudle[index - 1].end;
    b = scheudle[index].start;

    pauses.push(Timing.diff(b, a));
  }

  return pauses;
}

//ich will

function deepWorkFitness(schedule: Assignment[]): number {
  const pauses = getPauseTime(schedule);
  const minPause = 25 / 60; // 25 min in hours
  const maxMentalDistance = 20; // 20h Toleranz

  let score = 0;
  let count = 0;

  for (let i = 0; i < schedule.length; i++) {
    const a = schedule[i];

    if (a.v.task.activity === ActivityType.DEEP_WORK) {
      // --- Pause vor Deep Work ---
      if (i > 0) {
        const pauseHours = inHours(pauses[i - 1]);
        const pauseScore = Math.min(1, pauseHours / minPause);
        score += pauseScore;
        count++;
      }

      // --- Nach deep Work was mit Mental Health ---
      for (let x = i; x < schedule.length; x++) {
        if (schedule[x].v.task.activity === ActivityType.MENTAL_HEALTH) {
          const distance = inHours(schedule[x].start) - inHours(a.end);
          const mentalScore = Math.max(0, 1 - distance / maxMentalDistance);

          score += mentalScore;
          count++;
          break;
        }
      }
    }
  }

  return count === 0 ? 0 : score;
}

//ich will das gym relativ vorne ist!
function gymFitness(schedule: Assignment[]): number {
  const maxShift = 8; // 8h Spielraum
  let score = 0;
  let count = 0;

  for (const a of schedule) {
    if (a.v.task.activity === ActivityType.INDOOR_SPORT) {
      const diff = inHours(a.start) - inHours(DAY_START_TIME);

      const gymScore = Math.max(0, 1 - diff / maxShift);

      score += gymScore;
      count++;
    }
  }

  return count === 0 ? 1 : score;
}
//outdoorfitness bitte immer vor dem sunset den ich episch berechne
function outDoorFitness(schedule: Assignment[]): number {
  const sunset = getSunTime(zenith.OFFICIAL, TIME.SETTING);

  let score = 0;
  let count = 0;

  for (const a of schedule) {
    if (a.v.task.activity === ActivityType.OUTDOOR_SPORT) {
      if (isBefore(a.end, sunset)) {
        score += 1;
      } else {
        score += 0;
      }
      count++;
    }
  }

  return count === 0 ? 1 : score;
}

//1. Ich will das nach kurzen pausen eine lange kommt wir definieren kurze pause wie folgt < 15 und große 15 >
function gapFitness(schedule: Assignment[]): number {
  const pauses = getPauseTime(schedule);
  const shortPause = 15 / 60;

  let score = 0;
  let count = 0;

  for (let i = 1; i < pauses.length; i++) {
    const prev = inHours(pauses[i - 1]);
    const curr = inHours(pauses[i]);

    if (prev < shortPause) {
      const patternScore = curr > shortPause ? 1 : 0;
      score += patternScore;
      count++;
    }
  }

  return count === 0 ? 1 : score;
}

export default function Fitness(schedule: Assignment[]) {
  const gap = gapFitness(schedule);
  const gym = gymFitness(schedule);
  const outdoor = outDoorFitness(schedule);
  const deep = deepWorkFitness(schedule);

  return (
    pause_weight * gap +
    gym_weight * gym +
    outdoor_weight * outdoor +
    deep_work_weight * deep
  );
}
