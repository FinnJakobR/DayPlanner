import Task, { ActivityType } from "../models/task";
import { Duration, inHours, Time } from "../models/time";
import { FAKE_TASKS } from "../tests/fakeTasks";
import {
  getRandomArrayIndex,
  getRandomInt,
  getRandomTimeFromIntervall,
} from "../util/utility";

interface ActivityIntervall {
  num: number;
  minDuration: Duration;
  maxDuration: Duration;
}

export class DayTemplate {
  public activities: ActivityIntervall[];

  constructor() {
    this.activities = new Array(ActivityType.LENGTH);
  }

  generateRandomActivities(): ActivityType[] {
    let acts: ActivityType[] = [];

    for (let x = 0; x < ActivityType.LENGTH; x++) {
      for (
        let j = 0;
        j < Math.max(0, this.activities[x].num + getRandomInt(-1, 1));
        j++
      ) {
        acts.push(x);
      }
    }

    return acts;
  }

  generate(): Task[] {
    const acts = this.generateRandomActivities();
    const tasks: Task[] = [];

    for (const act of acts) {
      const randomTitle = FAKE_TASKS[getRandomArrayIndex(FAKE_TASKS.length)];
      const randomDuration = getRandomTimeFromIntervall(
        this.activities[act].minDuration,
        this.activities[act].maxDuration,
      );

      const deadline = new Time({ hour: 0, minute: 0, second: 0 });

      const randomPriority = getRandomInt(0, 10);

      tasks.push(
        new Task({
          title: randomTitle,
          deadline: deadline,
          priority: randomPriority,
          activity: act,
          duration: randomDuration,
        }),
      );
    }

    return tasks;
  }
}

export class NormalWeekDayTemplate extends DayTemplate {
  constructor() {
    super();

    this.activities[ActivityType.OUTDOOR_SPORT] = {
      num: 1,
      minDuration: new Duration({ hour: 0, minute: 45, second: 0 }),
      maxDuration: new Duration({ hour: 2, minute: 0, second: 0 }),
    };

    this.activities[ActivityType.INDOOR_SPORT] = {
      num: 1,
      minDuration: new Duration({ hour: 1, minute: 30, second: 0 }),
      maxDuration: new Duration({ hour: 2, minute: 30, second: 0 }),
    };

    this.activities[ActivityType.DEEP_WORK] = {
      num: 2,
      minDuration: new Duration({ hour: 1, minute: 0, second: 0 }),
      maxDuration: new Duration({ hour: 3, minute: 0, second: 0 }),
    };

    this.activities[ActivityType.MENTAL_HEALTH] = {
      num: 1,
      minDuration: new Duration({ hour: 0, minute: 20, second: 0 }),
      maxDuration: new Duration({ hour: 2, minute: 0, second: 0 }),
    };

    this.activities[ActivityType.HOUSEHOLD] = {
      num: 2,
      minDuration: new Duration({ hour: 0, minute: 10, second: 0 }),
      maxDuration: new Duration({ hour: 0, minute: 35, second: 0 }),
    };

    this.activities[ActivityType.DRIVING] = {
      num: 2,
      minDuration: new Duration({ hour: 0, minute: 20, second: 0 }),
      maxDuration: new Duration({ hour: 0, minute: 50, second: 0 }),
    };
  }
}

export class SemesterHolidayTemplate extends DayTemplate {
  constructor() {
    super();

    this.activities[ActivityType.OUTDOOR_SPORT] = {
      num: 1,
      minDuration: new Duration({ hour: 0, minute: 45, second: 0 }),
      maxDuration: new Duration({ hour: 2, minute: 0, second: 0 }),
    };

    this.activities[ActivityType.INDOOR_SPORT] = {
      num: 1,
      minDuration: new Duration({ hour: 1, minute: 30, second: 0 }),
      maxDuration: new Duration({ hour: 2, minute: 30, second: 0 }),
    };

    this.activities[ActivityType.DEEP_WORK] = {
      num: 0,
      minDuration: new Duration({ hour: 1, minute: 0, second: 0 }),
      maxDuration: new Duration({ hour: 2, minute: 30, second: 0 }),
    };

    this.activities[ActivityType.MENTAL_HEALTH] = {
      num: 3,
      minDuration: new Duration({ hour: 0, minute: 20, second: 0 }),
      maxDuration: new Duration({ hour: 2, minute: 0, second: 0 }),
    };

    this.activities[ActivityType.HOUSEHOLD] = {
      num: 2,
      minDuration: new Duration({ hour: 0, minute: 10, second: 0 }),
      maxDuration: new Duration({ hour: 0, minute: 35, second: 0 }),
    };

    this.activities[ActivityType.DRIVING] = {
      num: 2,
      minDuration: new Duration({ hour: 0, minute: 20, second: 0 }),
      maxDuration: new Duration({ hour: 0, minute: 50, second: 0 }),
    };
  }
}

export class DeepFocusDayTemplate extends DayTemplate {
  constructor() {
    super();

    this.activities[ActivityType.OUTDOOR_SPORT] = {
      num: 0,
      minDuration: new Duration({ hour: 0, minute: 45, second: 0 }),
      maxDuration: new Duration({ hour: 2, minute: 0, second: 0 }),
    };

    this.activities[ActivityType.INDOOR_SPORT] = {
      num: 0,
      minDuration: new Duration({ hour: 1, minute: 30, second: 0 }),
      maxDuration: new Duration({ hour: 2, minute: 30, second: 0 }),
    };

    this.activities[ActivityType.DEEP_WORK] = {
      num: 4,
      minDuration: new Duration({ hour: 1, minute: 0, second: 0 }),
      maxDuration: new Duration({ hour: 2, minute: 30, second: 0 }),
    };

    this.activities[ActivityType.MENTAL_HEALTH] = {
      num: 3,
      minDuration: new Duration({ hour: 0, minute: 20, second: 0 }),
      maxDuration: new Duration({ hour: 1, minute: 0, second: 0 }),
    };

    this.activities[ActivityType.HOUSEHOLD] = {
      num: 1,
      minDuration: new Duration({ hour: 0, minute: 10, second: 0 }),
      maxDuration: new Duration({ hour: 0, minute: 35, second: 0 }),
    };

    this.activities[ActivityType.DRIVING] = {
      num: 2,
      minDuration: new Duration({ hour: 0, minute: 20, second: 0 }),
      maxDuration: new Duration({ hour: 0, minute: 50, second: 0 }),
    };
  }
}

export class WeekendDayTemplate extends DayTemplate {
  constructor() {
    super();

    this.activities[ActivityType.OUTDOOR_SPORT] = {
      num: 1,
      minDuration: new Duration({ hour: 0, minute: 45, second: 0 }),
      maxDuration: new Duration({ hour: 2, minute: 0, second: 0 }),
    };

    this.activities[ActivityType.INDOOR_SPORT] = {
      num: 1,
      minDuration: new Duration({ hour: 1, minute: 30, second: 0 }),
      maxDuration: new Duration({ hour: 2, minute: 30, second: 0 }),
    };

    this.activities[ActivityType.DEEP_WORK] = {
      num: 1,
      minDuration: new Duration({ hour: 1, minute: 0, second: 0 }),
      maxDuration: new Duration({ hour: 2, minute: 0, second: 0 }),
    };

    this.activities[ActivityType.MENTAL_HEALTH] = {
      num: 3,
      minDuration: new Duration({ hour: 0, minute: 20, second: 0 }),
      maxDuration: new Duration({ hour: 1, minute: 0, second: 0 }),
    };

    this.activities[ActivityType.HOUSEHOLD] = {
      num: 4,
      minDuration: new Duration({ hour: 0, minute: 10, second: 0 }),
      maxDuration: new Duration({ hour: 0, minute: 35, second: 0 }),
    };

    this.activities[ActivityType.DRIVING] = {
      num: 2,
      minDuration: new Duration({ hour: 0, minute: 20, second: 0 }),
      maxDuration: new Duration({ hour: 0, minute: 50, second: 0 }),
    };
  }
}
