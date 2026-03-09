# DayPlanner 

## Generierung
---
Dieser DayPlanner nutzt evolutionäres Lernen um Tasks nach meinen Bedürfnissen zu genieren.

### Soft Constrains
Soft Constains werden mittels Fitness Funktion innerhalb des Evolutionären Algorithmusses gelöst.

### Hard Constrains
Hard Constrains werden mittels selbst gebauter CSP-Engine gelöst. 


## Scheudlen
---
Scheudlen übernimmt ein Agent welche mittels Reinforcment Learning und [Proximal Policy Optimization](https://arxiv.org/abs/1707.06347) gelernt wurde. 
Der Agent wurde auf *Stress-Managment*, *Energy-Managment*, *Location-Managment* und *Workslots* nach meinen individuellen Environment trainiert. 

### Action
Er kann folgende Actions 
- **NO_ACTION** 
- **SPLIT_TASK**
- **INSERT_BREAK**
- **FOCUS_TASK**
- **PULL_TASK_EARLIER**
- **DELAY_TASK**
