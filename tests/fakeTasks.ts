import Task, { ActivityType } from "../models/task.js";
import { Duration, Time } from "../models/time.js";
import {
  getRandomInt,
  getRandomTimeFromIntervall,
  unreachable,
} from "../util/utility.js";

export const FAKE_TASKS = [
  "Müll rausbringen",
  "Papiermüll entsorgen",
  "Biomüll leeren",
  "Einkaufen gehen",
  "Getränke kaufen",
  "Vorräte auffüllen",
  "Staubsaugen",
  "Wohnzimmer saugen",
  "Schlafzimmer saugen",
  "Flur wischen",
  "Bad putzen",
  "Toilette reinigen",
  "Dusche sauber machen",
  "Waschbecken putzen",
  "Spiegel reinigen",
  "Küche aufräumen",
  "Arbeitsfläche abwischen",
  "Herd reinigen",
  "Backofen sauber machen",
  "Kühlschrank auswischen",
  "Gefrierschrank abtauen",
  "Geschirr spülen",
  "Geschirrspüler einräumen",
  "Geschirrspüler ausräumen",
  "Töpfe abwaschen",
  "Pfannen reinigen",
  "Wäsche waschen",
  "Buntwäsche waschen",
  "Weißwäsche waschen",
  "Wäsche aufhängen",
  "Wäsche zusammenlegen",
  "Wäsche bügeln",
  "Socken sortieren",
  "Kleiderschrank aufräumen",
  "Alte Kleidung aussortieren",
  "Schuhe putzen",
  "Jacken aufhängen",
  "Bett beziehen",
  "Bettwäsche waschen",
  "Matratze absaugen",
  "Kissen lüften",
  "Pflanzen gießen",
  "Blumen umtopfen",
  "Vertrocknete Pflanzen entsorgen",
  "Balkon fegen",
  "Balkonmöbel reinigen",
  "Fenster putzen",
  "Fensterbank abwischen",
  "Rollos reinigen",
  "Vorhänge waschen",
  "Staub wischen",
  "Regale abstauben",
  "Bücher sortieren",
  "Schreibtisch aufräumen",
  "Kabel ordnen",
  "Ladekabel suchen",
  "Papierkram sortieren",
  "Rechnungen abheften",
  "Rechnung bezahlen",
  "Überweisung tätigen",
  "Konto prüfen",
  "Budget aktualisieren",
  "Abos überprüfen",
  "Versicherungspost lesen",
  "Post öffnen",
  "Brief zur Post bringen",
  "Paket abholen",
  "Paket wegbringen",
  "Retouren versenden",
  "E-Mails aufräumen",
  "Newsletter abbestellen",
  "Kalender aktualisieren",
  "Termine eintragen",
  "Arzttermin vereinbaren",
  "Zahnarzt anrufen",
  "Rezepte abholen",
  "Medikamente sortieren",
  "Hausapotheke prüfen",
  "Verbandskasten auffüllen",
  "Batterien wechseln",
  "Rauchmelder testen",
  "Glühbirnen austauschen",
  "Lampen entstauben",
  "Fernseher reinigen",
  "Fernbedienung sauber machen",
  "Computer herunterfahren",
  "Updates installieren",
  "Passwörter ändern",
  "Backup erstellen",
  "Fotos sortieren",
  "Dateien aufräumen",
  "Papierkorb leeren",
  "Downloads ordnen",
  "Apps aktualisieren",
  "Handy aufladen",
  "Alte Apps löschen",
  "Kontakte bereinigen",
  "Social Media checken",
  "Nachrichten beantworten",
  "Freunde zurückrufen",
  "Eltern anrufen",
  "Geburtstagskarte schreiben",
  "Geschenk besorgen",
  "Geschenk einpacken",
  "Dankesnachricht schreiben",
  "To-do-Liste aktualisieren",
  "Wochenplan erstellen",
  "Essensplan machen",
  "Rezepte raussuchen",
  "Einkaufsliste schreiben",
  "Kühlschrank checken",
  "Vorräte inventarisieren",
  "Gewürze sortieren",
  "Kaffeemaschine reinigen",
  "Wasserkocher entkalken",
  "Mikrowelle putzen",
  "Toaster reinigen",
  "Müllbeutel wechseln",
  "Putzmittel nachfüllen",
  "Spülmittel auffüllen",
  "Seife nachfüllen",
  "Handtücher wechseln",
  "Badematte waschen",
  "Schmutzwäsche sammeln",
  "Putzlappen waschen",
  "Eimer ausspülen",
  "Besenschrank aufräumen",
  "Staubsaugerbeutel wechseln",
  "Filter reinigen",
  "Heizung entlüften",
  "Thermostat einstellen",
  "Fenster kippen",
  "Stoßlüften",
  "Raumduft auffüllen",
  "Kerzenreste entsorgen",
  "Kerzen aufstellen",
  "Deko umstellen",
  "Fotos aufhängen",
  "Bilderrahmen reinigen",
  "Schlüssel sortieren",
  "Tasche aufräumen",
  "Rucksack ausmisten",
  "Portemonnaie sortieren",
  "Kassenbons entsorgen",
  "Ausweise prüfen",
  "Fahrkarte kaufen",
  "Auto saugen",
  "Auto waschen",
  "Scheiben reinigen",
  "Reifendruck prüfen",
  "Tank auffüllen",
  "Fahrrad putzen",
  "Fahrradkette ölen",
  "Luft aufpumpen",
  "Helm reinigen",
  "Schuhe imprägnieren",
  "Regenschirm trocknen",
  "Jackentaschen leeren",
  "Mülltrennung prüfen",
  "Altglas wegbringen",
  "Altpapier bündeln",
  "Sperrmüll anmelden",
  "Alte Geräte entsorgen",
  "Kabel recyceln",
  "Batterien entsorgen",
  "Leuchtmittel entsorgen",
  "Karton zerkleinern",
  "Keller aufräumen",
  "Abstellkammer sortieren",
  "Vorratsraum putzen",
  "Gästezimmer vorbereiten",
  "Handtücher falten",
  "Bett für Gäste machen",
  "Haustier füttern",
  "Katze füttern",
  "Hundenapf reinigen",
  "Katzenklo säubern",
  "Tierbedarf kaufen",
  "Tierarzttermin planen",
  "Leckerlis auffüllen",
  "Spielzeug wegräumen",
  "Wohnung lüften",
  "Gerüche beseitigen",
  "Luftfilter reinigen",
  "Notizen sortieren",
  "Ideenliste pflegen",
  "Ziele überprüfen",
  "Fortschritt tracken",
  "Motivationsplaylist starten",
];

function getRandomTask(): string {
  return FAKE_TASKS[Math.floor(Math.random() * FAKE_TASKS.length)];
}

function getRandomDuration({ min, max }: { min: Time; max: Time }) {
  return getRandomTimeFromIntervall(min, max);
}

function getRandomActivity(): ActivityType {
  const activities = ActivityType.LENGTH;

  const randomActivity = getRandomInt(0, activities - 1);

  if (randomActivity >= ActivityType.LENGTH) unreachable();

  return randomActivity;
}

export function generateFakeTasks(count: number): Task[] {
  const tasks: Task[] = [];

  const maxDuration = new Time({ hour: 0, minute: 45, second: 0 });
  const minDuration = new Time({ hour: 0, minute: 5, second: 0 });

  const saved_titles: string[] = [];

  for (let _ = 0; _ < count; _++) {
    let task_title = getRandomTask();

    while (saved_titles.includes(task_title)) {
      task_title = getRandomTask();
    }

    saved_titles.push(task_title);

    //let deadline = getRandomDuration({ min: minDuration, max: maxDuration });
    let duration = getRandomDuration({ min: minDuration, max: maxDuration });
    let priority = getRandomInt(0, 10);

    tasks.push(
      new Task({
        title: task_title,
        duration: duration,
        deadline: new Time({
          hour: Infinity,
          minute: Infinity,
          second: Infinity,
        }),
        priority: priority,
        activity: getRandomActivity(),
      }),
    );
  }

  return tasks;
}
