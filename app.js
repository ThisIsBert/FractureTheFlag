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
  flagFrame: document.querySelector(".flag-frame"),
  flagImage: document.querySelector("#flagImage"),
  confettiLayer: document.querySelector("#confettiLayer"),
  flagRevealButton: document.querySelector("#flagRevealButton"),
  roundOverlay: document.querySelector("#roundOverlay"),
  visibilityBar: document.querySelector(".visibility-bar"),
  visibilityFill: document.querySelector("#visibilityFill"),
  visibilityText: document.querySelector("#visibilityText"),
  guessForm: document.querySelector("#guessForm"),
  guessInput: document.querySelector("#countryGuess"),
  guessSubmitButton: document.querySelector("#guessSubmitButton"),
  countryOptions: document.querySelector("#countryOptions"),
  scoreRound: document.querySelector("#scoreRound"),
  scoreCorrect: document.querySelector("#scoreCorrect"),
  scoreWrong: document.querySelector("#scoreWrong"),
  scoreAverage: document.querySelector("#scoreAverage"),
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
  successVisibilities: [],
  confettiTimeoutId: null,
  roundLoadToken: 0
};

const CONFETTI_COLORS = ["#ce4a2d", "#f59e0b", "#166534", "#0f766e", "#102542", "#fdf2c4"];

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

const isKnownCountryGuess = (guess) => {
  const normalizedGuess = normalize(guess);
  if (!normalizedGuess) {
    return false;
  }

  return state.countries.some((country) =>
    country.answers.some((answer) => normalize(answer) === normalizedGuess)
  );
};

const getVisibilityPercent = () => Math.round((state.revealed.size / TILE_COUNT) * 100);

const updateScoreboard = () => {
  const currentRound = state.currentIndex >= 0 ? Math.min(state.currentIndex + 1, state.deck.length) : 0;
  elements.scoreRound.textContent = `${currentRound} von ${state.deck.length}`;
  elements.scoreCorrect.textContent = String(state.correctCount);
  elements.scoreWrong.textContent = String(state.wrongCount);
  const average =
    state.successVisibilities.length === 0
      ? 0
      : Math.round(
          state.successVisibilities.reduce((sum, value) => sum + value, 0) /
            state.successVisibilities.length
        );
  elements.scoreAverage.textContent = `${average}%`;
};

const updateVisibility = () => {
  const percent = getVisibilityPercent();
  elements.visibilityFill.style.width = `${percent}%`;
  elements.visibilityText.textContent = `Sichtbar: ${percent}%`;
  elements.visibilityText.className = "visibility-text";
  elements.visibilityBar.hidden = false;
};

const showRoundResult = (success) => {
  elements.visibilityBar.hidden = true;
  elements.visibilityText.textContent = state.currentCountry.name;
  elements.visibilityText.className = `visibility-text is-result is-${success ? "success" : "danger"}`;
};

const updateGuessButtonState = () => {
  if (state.finishedRound) {
    elements.guessSubmitButton.disabled = false;
    elements.guessSubmitButton.textContent = "Nächste Runde";
    return;
  }

  elements.guessSubmitButton.textContent = "Raten";
  elements.guessSubmitButton.disabled = !isKnownCountryGuess(elements.guessInput.value);
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

const clearConfetti = () => {
  if (state.confettiTimeoutId) {
    window.clearTimeout(state.confettiTimeoutId);
    state.confettiTimeoutId = null;
  }

  elements.confettiLayer.replaceChildren();
};

const triggerWinConfetti = () => {
  clearConfetti();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const fragment = document.createDocumentFragment();
  const pieceCount = 34;

  for (let index = 0; index < pieceCount; index += 1) {
    const piece = document.createElement("span");
    const angle = (-110 + (220 / pieceCount) * index) * (Math.PI / 180);
    const distance = 150 + Math.random() * 210;
    const originX = (Math.random() - 0.5) * 180;
    const driftX = Math.cos(angle) * distance;
    const driftY = Math.sin(angle) * distance + 150 + Math.random() * 140;
    const size = 0.4 + Math.random() * 0.55;
    const shapeRoll = Math.random();

    piece.className = "confetti-piece";
    if (shapeRoll > 0.68) {
      piece.classList.add("is-square");
    } else if (shapeRoll < 0.18) {
      piece.classList.add("is-ring");
    }

    piece.style.setProperty("--size", `${size}rem`);
    piece.style.setProperty("--origin-x", `${Math.round(originX)}px`);
    piece.style.setProperty("--drift-x", `${Math.round(driftX)}px`);
    piece.style.setProperty("--drift-y", `${Math.round(driftY)}px`);
    piece.style.setProperty("--rotation", `${Math.round((Math.random() - 0.5) * 1080)}deg`);
    piece.style.setProperty(
      "--confetti-color",
      CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
    );
    piece.style.animationDelay = `${Math.round(Math.random() * 260)}ms`;
    fragment.append(piece);
  }

  elements.confettiLayer.append(fragment);
  state.confettiTimeoutId = window.setTimeout(clearConfetti, 2400);
};

const finishRound = (success) => {
  const visibility = getVisibilityPercent();
  state.finishedRound = true;
  revealAllTiles();
  elements.guessInput.disabled = true;
  elements.flagRevealButton.ariaLabel =
    state.currentIndex >= state.deck.length - 1 ? "Neuen Lauf starten" : "Naechste Flagge starten";
  elements.roundOverlay.hidden = true;
  elements.roundOverlay.textContent = "";
  showRoundResult(success);
  updateGuessButtonState();

  if (success) {
    setFlagFrameTone("success");
    triggerWinConfetti();
    state.correctCount += 1;
    state.successVisibilities.push(visibility);
  } else {
    clearConfetti();
    setFlagFrameTone("danger");
    state.wrongCount += 1;
  }

  updateScoreboard();
};

const isCorrectGuess = (guess) => {
  const normalizedGuess = normalize(guess);
  return state.currentCountry.answers.some((answer) => normalize(answer) === normalizedGuess);
};

const loadRound = () => {
  const roundLoadToken = state.roundLoadToken + 1;
  const nextAsset = state.deck[state.currentIndex].asset;
  state.roundLoadToken = roundLoadToken;
  state.currentCountry = state.deck[state.currentIndex];
  state.revealed = new Set();
  state.finishedRound = false;
  clearConfetti();
  elements.flagFrame.classList.remove("is-success", "is-danger");
  elements.flagImage.hidden = true;
  elements.flagImage.alt = `Verdeckte Flagge von ${state.currentCountry.name}`;
  elements.flagRevealButton.disabled = true;
  elements.flagRevealButton.ariaLabel = "Eine weitere Kachel aufdecken";
  elements.roundOverlay.hidden = true;
  elements.roundOverlay.textContent = "";
  elements.guessInput.blur();
  elements.guessInput.disabled = false;
  elements.guessInput.value = "";
  updateGuessButtonState();
  updateScoreboard();

  loadImage(nextAsset)
    .then((image) => {
      if (state.roundLoadToken !== roundLoadToken || state.currentCountry?.asset !== nextAsset) {
        return;
      }

      if (image.naturalWidth && image.naturalHeight) {
        elements.flagFrame.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
      } else {
        elements.flagFrame.style.aspectRatio = "3 / 2";
      }

      elements.flagImage.src = image.src;
      elements.flagImage.hidden = false;
      elements.flagRevealButton.disabled = false;
      revealRandomTile();
    })
    .catch((error) => {
      if (state.roundLoadToken !== roundLoadToken) {
        return;
      }

      console.error("Flag image failed to load", error);
      elements.flagFrame.style.aspectRatio = "3 / 2";
      elements.flagImage.src = nextAsset;
      elements.flagImage.hidden = false;
      elements.flagRevealButton.disabled = false;
      revealRandomTile();
    });
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
  const average =
    state.successVisibilities.length === 0
      ? 0
      : Math.round(
          state.successVisibilities.reduce((sum, value) => sum + value, 0) /
            state.successVisibilities.length
        );
  elements.roundOverlay.hidden = false;
  elements.roundOverlay.innerHTML = `Lauf beendet<br>${state.correctCount} Treffer / ${average}% im Schnitt`;
  updateGuessButtonState();
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

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const registerServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) {
        return;
      }

      refreshing = true;
      window.location.reload();
    });

    const registration = await navigator.serviceWorker.register("sw.js");
    await registration.update();
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
    if (state.currentIndex >= state.deck.length - 1) {
      startGame();
      return;
    }

    goToNextRound();
    return;
  }

  if (!isKnownCountryGuess(elements.guessInput.value)) {
    return;
  }

  if (isCorrectGuess(elements.guessInput.value)) {
    finishRound(true);
    return;
  }

  finishRound(false);
});

elements.guessInput.addEventListener("input", updateGuessButtonState);

init().catch((error) => {
  console.error(error);
});
