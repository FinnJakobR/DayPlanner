# DayPlanner

## Generation

This DayPlanner uses evolutionary learning to generate tasks according to my personal needs and preferences.

### Soft Constraints

Soft constraints are handled through a **fitness function** within the evolutionary algorithm.
The fitness function evaluates candidate schedules based on criteria such as efficiency, balance, and preference alignment.

### Hard Constraints

Hard constraints are enforced using a custom-built **Constraint Satisfaction Problem (CSP) engine**.
This engine guarantees that fundamental requirements—such as time conflicts or logical dependencies—are always satisfied.

---

## Scheduling

Scheduling is handled by an agent trained using reinforcement learning with **Proximal Policy Optimization (PPO)**.

The agent was trained in a personalized environment focusing on:

* **Stress management**
* **Energy management**
* **Location management**
* **Work slot allocation**

Proximal Policy Optimization is a policy-gradient reinforcement learning algorithm designed to provide **stable and efficient training**.
It works by updating the policy while limiting how much it can change between updates using a clipped objective function.
This prevents overly large policy updates that could destabilize training while still allowing the model to learn effectively from new experiences.

---

## Actions

The agent can perform the following actions:

* **NO_ACTION** – Leave the schedule unchanged.
* **SPLIT_TASK** – Divide a task into smaller segments.
* **INSERT_BREAK** – Insert a break to manage energy and stress.
* **FOCUS_TASK** – Prioritize and allocate focused time to a task.
* **PULL_TASK_EARLIER** – Move a task to an earlier time slot.
* **DELAY_TASK** – Postpone a task to a later time slot.


## Lerning 

![Learn to use NO_ACTION as Fallback](https://raw.githubusercontent.com/FinnJakobR/DayPlanner/refs/heads/main/assets/lernNoError.png)