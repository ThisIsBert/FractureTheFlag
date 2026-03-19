const TILE_COUNT = 100;
const GERMAN_REGION_NAMES = new Intl.DisplayNames(["de"], { type: "region" });
const ENGLISH_REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

const SPECIAL_FLAGS = {
  "gb-eng": { name: "England", answers: ["England"] },
  "gb-nir": { name: "Nordirland", answers: ["Nordirland", "Northern Ireland"] },
  "gb-sct": { name: "Schottland", answers: ["Schottland", "Scotland"] },
  "gb-wls": { name: "Wales", answers: ["Wales"] },
  xk: { name: "Kosovo", answers: ["Kosovo"] }
};

const EXTRA_ALIASES = {
  gb: ["Grossbritannien", "Großbritannien", "Great Britain", "United Kingdom", "UK"],
  us: ["USA", "United States", "United States of America", "Vereinigte Staaten"],
  ae: ["VAE", "UAE", "Vereinigte Arabische Emirate", "United Arab Emirates"],
  cz: ["Tschechien", "Czechia", "Czech Republic"],
  nl: ["Holland", "Niederlande", "Netherlands"],
  mk: ["Nordmazedonien", "North Macedonia"],
  ci: ["Elfenbeinkueste", "Elfenbeinküste", "Ivory Coast", "Cote d Ivoire", "Côte d'Ivoire"],
  cd: ["DR Kongo", "Demokratische Republik Kongo", "Democratic Republic of the Congo"],
  cg: ["Republik Kongo", "Republic of the Congo"],
  tw: ["Taiwan"],
  va: ["Vatikan", "Vatican City"],
  fm: ["Mikronesien", "Micronesia"],
  mm: ["Myanmar", "Burma"],
  ps: ["Palaestina", "Palästina", "Palestine"],
  sy: ["Syrien", "Syria"],
  tl: ["Osttimor", "Timor-Leste"],
  sz: ["Eswatini", "Swasiland", "Swaziland"],
  cv: ["Kap Verde", "Cabo Verde"],
  bq: ["Karibische Niederlande", "Caribbean Netherlands"],
  um: ["Amerikanische Ueberseeinseln", "Amerikanische Überseeinseln", "United States Minor Outlying Islands"],
  fk: ["Falklandinseln", "Falkland Islands"],
  fo: ["Faeroeer", "Färöer", "Faroe Islands"],
  tf: ["Franzoesische Sued- und Antarktisgebiete", "Französische Süd- und Antarktisgebiete"],
  io: ["Britisches Territorium im Indischen Ozean", "British Indian Ocean Territory"],
  vg: ["Britische Jungferninseln", "British Virgin Islands"],
  vi: ["Amerikanische Jungferninseln", "United States Virgin Islands"]
};

const elements = {
  roundLabel: document.querySelector("#roundLabel"),
  correctLabel: document.querySelector("#correctLabel"),
  wrongLabel: document.querySelector("#wrongLabel"),
  flagFrame: document.querySelector(".flag-frame"),
  flagImage: document.querySelector("#flagImage"),
  flagRevealButton: document.querySelector("#flagRevealButton"),
  roundOverlay: document.querySelector("#roundOverlay"),
  visibilityFill: document.querySelector("#visibilityFill"),
  visibilityText: document.querySelector("#visibilityText"),
  guessForm: document.querySelector("#guessForm"),
  guessInput: document.querySelector("#countryGuess"),
  countryOptions: document.querySelector("#countryOptions"),
  messageBox: document.querySelector("#messageBox"),
  nextButton: document.querySelector("#nextButton"),
  restartButton: document.querySelector("#restartButton"),
  scoreCorrect: document.querySelector("#scoreCorrect"),
  scoreAverage: document.querySelector("#scoreAverage"),
  scoreRemaining: document.querySelector("#scoreRemaining")
};

const state = {
  countries: [],
  deck: [],
  currentIndex: -1,
  currentCountry: null,
  revealed: new Set(),
  finishedRound: false,
  correctCount: 0,
  wrongCount: 0,
  successVisibilities: []
};

const normalize = (value) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const dedupeAnswers = (answers) => {
  const seen = new Set();
  return answers.filter((answer) => {
    const key = normalize(answer);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const buildCountryFromCode = (code) => {
  const specialFlag = SPECIAL_FLAGS[code];
  if (specialFlag) {
    return {
      id: code,
      code,
      name: specialFlag.name,
      answers: dedupeAnswers([...specialFlag.answers, specialFlag.name, code.toUpperCase()]),
      asset: `assets/flags/svg/${code}.svg`
    };
  }

  const regionCode = code.toUpperCase();
  const germanName = GERMAN_REGION_NAMES.of(regionCode) || regionCode;
  const englishName = ENGLISH_REGION_NAMES.of(regionCode) || regionCode;

  return {
    id: code,
    code,
    name: germanName,
    answers: dedupeAnswers([
      germanName,
      englishName,
      regionCode,
      ...(EXTRA_ALIASES[code] || [])
    ]),
    asset: `assets/flags/svg/${code}.svg`
  };
};

const shuffle = (items) => {
  const clone = [...items];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }
  return clone;
};

const setMessage = (text, tone = "") => {
  elements.messageBox.textContent = text;
  elements.messageBox.className = `message-box${tone ? ` is-${tone}` : ""}`;
};

const getVisibilityPercent = () => Math.round((state.revealed.size / TILE_COUNT) * 100);

const updateScoreboard = () => {
  elements.roundLabel.textContent = `${Math.max(state.currentIndex + 1, 0)} / ${state.deck.length}`;
  elements.correctLabel.textContent = String(state.correctCount);
  elements.wrongLabel.textContent = String(state.wrongCount);
  elements.scoreCorrect.textContent = String(state.correctCount);
  const average =
    state.successVisibilities.length === 0
      ? 0
      : Math.round(
          state.successVisibilities.reduce((sum, value) => sum + value, 0) /
            state.successVisibilities.length
        );
  elements.scoreAverage.textContent = `${average}%`;
  elements.scoreRemaining.textContent = String(Math.max(state.deck.length - state.currentIndex - 1, 0));
};

const updateVisibility = () => {
  const percent = getVisibilityPercent();
  elements.visibilityFill.style.width = `${percent}%`;
  elements.visibilityText.textContent = `Sichtbar: ${percent}%`;
};

const buildTiles = () => {
  elements.flagRevealButton.innerHTML = "";
  for (let index = 0; index < TILE_COUNT; index += 1) {
    const tile = document.createElement("span");
    tile.className = "tile";
    tile.dataset.index = String(index);
    elements.flagRevealButton.append(tile);
  }
};

const syncTiles = () => {
  elements.flagRevealButton.querySelectorAll(".tile").forEach((tile) => {
    tile.classList.toggle("is-revealed", state.revealed.has(Number(tile.dataset.index)));
  });
};

const revealRandomTile = () => {
  if (state.finishedRound || state.revealed.size >= TILE_COUNT) {
    return;
  }

  const hiddenTiles = [];
  for (let index = 0; index < TILE_COUNT; index += 1) {
    if (!state.revealed.has(index)) {
      hiddenTiles.push(index);
    }
  }

  const nextTile = hiddenTiles[Math.floor(Math.random() * hiddenTiles.length)];
  state.revealed.add(nextTile);
  syncTiles();
  updateVisibility();
};

const revealAllTiles = () => {
  for (let index = 0; index < TILE_COUNT; index += 1) {
    state.revealed.add(index);
  }
  syncTiles();
  updateVisibility();
};

const setFlagFrameTone = (tone) => {
  elements.flagFrame.classList.remove("is-success", "is-danger");
  elements.flagFrame.classList.add(tone === "success" ? "is-success" : "is-danger");
};

const finishRound = (success) => {
  const visibility = getVisibilityPercent();
  state.finishedRound = true;
  revealAllTiles();
  elements.guessInput.disabled = true;
  elements.nextButton.hidden = state.currentIndex >= state.deck.length - 1;
  elements.restartButton.hidden = state.currentIndex < state.deck.length - 1;
  elements.flagRevealButton.ariaLabel =
    state.currentIndex >= state.deck.length - 1 ? "Neuen Lauf starten" : "Naechste Flagge starten";
  elements.roundOverlay.hidden = true;
  elements.roundOverlay.textContent = "";

  if (success) {
    setFlagFrameTone("success");
    state.correctCount += 1;
    state.successVisibilities.push(visibility);
    setMessage(
      `Richtig: ${state.currentCountry.name}. Du hast die Flagge bei ${visibility}% Sichtbarkeit erkannt. Tippe auf die Flagge fuer die naechste Runde.`,
      "success"
    );
  } else {
    setFlagFrameTone("danger");
    state.wrongCount += 1;
    setMessage(
      `Falsch. Es war ${state.currentCountry.name}. Tippe auf die Flagge fuer die naechste Runde.`,
      "danger"
    );
  }

  updateScoreboard();
};

const isCorrectGuess = (guess) => {
  const normalizedGuess = normalize(guess);
  return state.currentCountry.answers.some((answer) => normalize(answer) === normalizedGuess);
};

const loadRound = () => {
  state.currentCountry = state.deck[state.currentIndex];
  state.revealed = new Set();
  state.finishedRound = false;
  elements.flagFrame.classList.remove("is-success", "is-danger");
  elements.flagImage.src = state.currentCountry.asset;
  elements.flagImage.alt = `Verdeckte Flagge von ${state.currentCountry.name}`;
  elements.flagImage.hidden = false;
  elements.flagRevealButton.disabled = false;
  elements.flagRevealButton.ariaLabel = "Eine weitere Kachel aufdecken";
  elements.roundOverlay.hidden = true;
  elements.roundOverlay.textContent = "";
  elements.guessInput.disabled = false;
  elements.guessInput.value = "";
  elements.guessInput.focus();
  elements.nextButton.hidden = true;
  elements.restartButton.hidden = true;
  setMessage("Eine Kachel ist offen. Rate jetzt oder decke mehr auf.");
  revealRandomTile();
  updateScoreboard();
};

const startGame = () => {
  state.deck = shuffle(state.countries);
  state.currentIndex = 0;
  state.correctCount = 0;
  state.wrongCount = 0;
  state.successVisibilities = [];
  buildTiles();
  loadRound();
};

const goToNextRound = () => {
  state.currentIndex += 1;
  if (state.currentIndex >= state.deck.length) {
    finishGame();
    return;
  }
  buildTiles();
  loadRound();
};

const finishGame = () => {
  state.finishedRound = true;
  elements.guessInput.disabled = true;
  elements.nextButton.hidden = true;
  elements.restartButton.hidden = false;
  const average =
    state.successVisibilities.length === 0
      ? 0
      : Math.round(
          state.successVisibilities.reduce((sum, value) => sum + value, 0) /
            state.successVisibilities.length
        );
  elements.roundOverlay.hidden = false;
  elements.roundOverlay.innerHTML = `Lauf beendet<br>${state.correctCount} Treffer / ${average}% im Schnitt`;
  setMessage("Alle Flaggen wurden gespielt. Du kannst direkt einen neuen Lauf starten.");
  updateScoreboard();
};

const populateDatalist = () => {
  elements.countryOptions.innerHTML = "";
  state.countries
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, "de"))
    .forEach((country) => {
      const option = document.createElement("option");
      option.value = country.name;
      elements.countryOptions.append(option);
    });
};

const updateFlagAspectRatio = () => {
  const { naturalWidth, naturalHeight } = elements.flagImage;
  if (!naturalWidth || !naturalHeight) {
    elements.flagFrame.style.aspectRatio = "3 / 2";
    return;
  }
  elements.flagFrame.style.aspectRatio = `${naturalWidth} / ${naturalHeight}`;
};

const registerServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("sw.js");
  } catch (error) {
    console.error("Service worker registration failed", error);
  }
};

const init = async () => {
  const response = await fetch("data/flag-codes.json");
  const codes = await response.json();
  state.countries = codes.map(buildCountryFromCode);
  populateDatalist();
  startGame();
  registerServiceWorker();
};

elements.flagImage.addEventListener("load", updateFlagAspectRatio);

elements.flagRevealButton.addEventListener("click", () => {
  if (state.finishedRound) {
    if (state.currentIndex >= state.deck.length - 1) {
      startGame();
      return;
    }
    goToNextRound();
    return;
  }

  revealRandomTile();
});

elements.guessForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.finishedRound) {
    return;
  }

  if (isCorrectGuess(elements.guessInput.value)) {
    finishRound(true);
    return;
  }

  finishRound(false);
});

elements.nextButton.addEventListener("click", goToNextRound);
elements.restartButton.addEventListener("click", startGame);

init().catch((error) => {
  console.error(error);
  setMessage("Die App konnte nicht initialisiert werden.", "danger");
});
