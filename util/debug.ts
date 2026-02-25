import fs from "fs";
import { Assignment } from "../csp/csp.js";
import { ActivityType } from "../models/task.js";
import { inHours, Timing } from "../models/time.js";

function activityToString(a: ActivityType): string {
  return ActivityType[a];
}

function formatTime(t: any): string {
  const hh = String(t.hour).padStart(2, "0");
  const mm = String(t.minute).padStart(2, "0");
  const ss = String(t.second).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function writeToFile(path: string, schedule: Assignment[]) {
  // Nach Startzeit sortieren
  const sorted = [...schedule].sort(
    (a, b) => inHours(a.start) - inHours(b.start),
  );

  let output = "";
  output += "================= SCHEDULE DEBUG =================\n\n";

  let totalWorkHours = 0;

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const task = a.v.task;

    const startStr = formatTime(a.start);
    const endStr = formatTime(a.end);
    const activityStr = activityToString(task.activity);

    output += `#${i + 1}\n`;
    output += `Task      : ${task.title}\n`;
    output += `Activity  : ${activityStr}\n`;
    output += `Start     : ${startStr}\n`;
    output += `End       : ${endStr}\n`;
    output += `Duration  : ${inHours(task.duration).toFixed(2)}h\n`;
    output += `Priority  : ${task.priority}\n`;
    output += `---------------------------------------------\n`;

    totalWorkHours += inHours(task.duration);

    // Pause zur nächsten Aufgabe
    if (i < sorted.length - 1) {
      const next = sorted[i + 1];
      const pause = Timing.diff(next.start, a.end);
      output += `Pause → ${inHours(pause).toFixed(2)}h\n`;
      output += `=============================================\n`;
    }
  }

  output += "\n================= SUMMARY =================\n";
  output += `Total Tasks   : ${sorted.length}\n`;
  output += `Total Worktime: ${totalWorkHours.toFixed(2)}h\n`;
  output += "=============================================\n";

  console.log(output);

  fs.writeFileSync(path, output, { encoding: "utf-8" });
}
