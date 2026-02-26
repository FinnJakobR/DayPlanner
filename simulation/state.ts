import { Assignment } from "../csp/csp.js";
import { Time } from "../models/time.js";

export default class State {
  public current_task: number = 0.0;
  public energy: number = 1.0;
  public stress: number = 0.0;
  public remaining_tasks: number = 0.0;
  public delayInMinutes: number = 0.0;
  public nextDeadlinesInMinutes: number[] = [];
  public scheudle: Assignment[] = [];

  constructor() {}
}
