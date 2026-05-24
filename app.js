(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.themeParams) {
      const root = document.documentElement;
      if (tg.themeParams.bg_color) root.style.setProperty("--tg-bg", tg.themeParams.bg_color);
      if (tg.themeParams.text_color) root.style.setProperty("--tg-text", tg.themeParams.text_color);
      if (tg.themeParams.hint_color) root.style.setProperty("--tg-hint", tg.themeParams.hint_color);
      if (tg.themeParams.button_color) root.style.setProperty("--tg-button", tg.themeParams.button_color);
      if (tg.themeParams.button_text_color) {
        root.style.setProperty("--tg-button-text", tg.themeParams.button_text_color);
      }
    }
  }

  const SIZE = 11;
  const MAX_WORDS = 7;
  const LETTERS = "ЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ".split("");
  const data = (window.ZOOMER_WORDS || [])
    .map((item) => ({
      ...item,
      answer: normalizeAnswer(item.word),
    }))
    .filter((item) => item.answer.length >= 4 && item.answer.length <= 9);

  const state = {
    puzzle: null,
    selectedClueId: null,
    selectedCellKey: null,
    entries: {},
    checkedCells: new Map(),
    mistakes: 0,
  };

  const board = document.getElementById("board");
  const keyboard = document.getElementById("keyboard");
  const solvedCount = document.getElementById("solvedCount");
  const totalCount = document.getElementById("totalCount");
  const mistakesCount = document.getElementById("mistakesCount");
  const clueNumber = document.getElementById("clueNumber");
  const clueDirection = document.getElementById("clueDirection");
  const clueLength = document.getElementById("clueLength");
  const clueText = document.getElementById("clueText");
  const toast = document.getElementById("toast");

  document.getElementById("newGameButton").addEventListener("click", startNewGame);
  document.getElementById("checkButton").addEventListener("click", checkPuzzle);
  document.getElementById("hintButton").addEventListener("click", revealLetter);
  document.addEventListener("keydown", onHardwareKey);

  buildKeyboard();
  startNewGame();

  function normalizeAnswer(value) {
    return String(value || "")
      .trim()
      .replace(/ё/gi, "е")
      .toUpperCase()
      .replace(/[^А-Я]/g, "");
  }

  function buildKeyboard() {
    keyboard.innerHTML = "";
    LETTERS.forEach((letter) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "key";
      button.textContent = letter;
      button.addEventListener("click", () => enterLetter(letter));
      keyboard.appendChild(button);
    });

    const backspace = document.createElement("button");
    backspace.type = "button";
    backspace.className = "key wide";
    backspace.textContent = "стереть";
    backspace.addEventListener("click", eraseLetter);
    keyboard.appendChild(backspace);

    const check = document.createElement("button");
    check.type = "button";
    check.className = "key wide accent";
    check.textContent = "готово";
    check.addEventListener("click", checkPuzzle);
    keyboard.appendChild(check);
  }

  function startNewGame() {
    state.puzzle = createPuzzle();
    state.entries = {};
    state.checkedCells = new Map();
    state.mistakes = 0;
    state.selectedClueId = state.puzzle.clues[0].id;
    state.selectedCellKey = cellKey(state.puzzle.clues[0].cells[0]);
    totalCount.textContent = String(state.puzzle.clues.length);
    render();
    showToast("Новая сетка готова");
  }

  function createPuzzle() {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const items = shuffle(data).filter((item) => item.answer.length <= 8);
      const grid = createGrid();
      const clues = [];
      const first = items.find((item) => item.answer.length >= 5 && item.answer.length <= 7) || items[0];
      if (!first) break;

      const startCol = Math.max(1, Math.floor((SIZE - first.answer.length) / 2));
      placeWord(grid, clues, first, Math.floor(SIZE / 2), startCol, "across");

      for (const item of items) {
        if (clues.length >= MAX_WORDS) break;
        if (clues.some((clue) => clue.answer === item.answer)) continue;
        const placement = findPlacement(grid, item);
        if (placement) placeWord(grid, clues, item, placement.row, placement.col, placement.direction);
      }

      if (clues.length >= 5) {
        return { grid, clues: clues.map((clue, index) => ({ ...clue, number: index + 1 })) };
      }
    }

    return createFallbackPuzzle();
  }

  function createGrid() {
    return Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => ({
        type: "empty",
        letter: "",
        clueIds: [],
      })),
    );
  }

  function findPlacement(grid, item) {
    const placements = [];
    const answer = item.answer;

    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        const cell = grid[row][col];
        if (cell.type !== "letter") continue;

        for (let i = 0; i < answer.length; i += 1) {
          if (answer[i] !== cell.letter) continue;
          const across = { row, col: col - i, direction: "across" };
          const down = { row: row - i, col, direction: "down" };
          [across, down].forEach((candidate) => {
            const score = canPlace(grid, answer, candidate.row, candidate.col, candidate.direction);
            if (score > 0) placements.push({ ...candidate, score });
          });
        }
      }
    }

    return shuffle(placements)
      .sort((a, b) => b.score - a.score)
      .at(0);
  }

  function canPlace(grid, answer, row, col, direction) {
    const dr = direction === "down" ? 1 : 0;
    const dc = direction === "across" ? 1 : 0;
    const clueRow = row - dr;
    const clueCol = col - dc;
    const endRow = row + dr * answer.length;
    const endCol = col + dc * answer.length;

    if (!inBounds(row, col) || !inBounds(clueRow, clueCol)) return 0;
    if (endRow >= SIZE || endCol >= SIZE) return 0;
    if (grid[clueRow][clueCol].type !== "empty") return 0;
    if (inBounds(endRow, endCol) && grid[endRow][endCol].type === "letter") return 0;

    let crossings = 0;
    for (let i = 0; i < answer.length; i += 1) {
      const r = row + dr * i;
      const c = col + dc * i;
      const cell = grid[r][c];
      if (cell.type === "clue") return 0;
      if (cell.type === "letter") {
        if (cell.letter !== answer[i]) return 0;
        crossings += 1;
        continue;
      }

      const sideA = direction === "across" ? [r - 1, c] : [r, c - 1];
      const sideB = direction === "across" ? [r + 1, c] : [r, c + 1];
      if (isLetter(grid, sideA[0], sideA[1]) || isLetter(grid, sideB[0], sideB[1])) return 0;
    }

    return crossings;
  }

  function placeWord(grid, clues, item, row, col, direction) {
    const answer = item.answer;
    const dr = direction === "down" ? 1 : 0;
    const dc = direction === "across" ? 1 : 0;
    const clueId = `clue-${clues.length + 1}-${Math.random().toString(16).slice(2)}`;
    const cells = [];

    grid[row - dr][col - dc] = {
      type: "clue",
      clueId,
      direction,
    };

    for (let i = 0; i < answer.length; i += 1) {
      const r = row + dr * i;
      const c = col + dc * i;
      grid[r][c] = {
        type: "letter",
        letter: answer[i],
        clueIds: [...(grid[r][c].clueIds || []), clueId],
      };
      cells.push({ row: r, col: c });
    }

    clues.push({
      id: clueId,
      word: item.word,
      answer,
      definition: item.definition,
      category: item.category,
      direction,
      cells,
    });
  }

  function createFallbackPuzzle() {
    const fallback = [
      { word: "вайб", definition: "атмосфера, настроение, ощущение от чего-то", category: "Эмоции" },
      { word: "краш", definition: "объект сильной симпатии, влюблённости", category: "Эмоции" },
      { word: "чилл", definition: "расслабление, спокойствие", category: "Эмоции" },
      { word: "имба", definition: "что-то слишком сильное или хорошее", category: "Гейминг" },
      { word: "рофл", definition: "шутка, смех, прикол", category: "Общение" },
    ].map((item) => ({ ...item, answer: normalizeAnswer(item.word) }));
    const grid = createGrid();
    const clues = [];
    placeWord(grid, clues, fallback[0], 2, 2, "across");
    placeWord(grid, clues, fallback[1], 4, 6, "down");
    placeWord(grid, clues, fallback[2], 6, 1, "across");
    placeWord(grid, clues, fallback[3], 8, 2, "across");
    placeWord(grid, clues, fallback[4], 1, 8, "down");
    return { grid, clues: clues.map((clue, index) => ({ ...clue, number: index + 1 })) };
  }

  function render() {
    renderBoard();
    renderClue();
    updateStatus();
  }

  function renderBoard() {
    board.style.setProperty("--size", SIZE);
    board.innerHTML = "";
    const activeClue = getActiveClue();
    const activeKeys = new Set((activeClue ? activeClue.cells : []).map(cellKey));

    state.puzzle.grid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = `cell ${cell.type}`;
        el.dataset.row = rowIndex;
        el.dataset.col = colIndex;

        if (cell.type === "letter") {
          const key = `${rowIndex}:${colIndex}`;
          el.textContent = state.entries[key] || "";
          if (key === state.selectedCellKey) el.classList.add("active");
          if (activeKeys.has(key)) el.classList.add("path");
          if (state.checkedCells.get(key) === "correct") el.classList.add("correct");
          if (state.checkedCells.get(key) === "wrong") el.classList.add("wrong");
          el.addEventListener("click", () => selectCell(rowIndex, colIndex));
        } else if (cell.type === "clue") {
          const clue = state.puzzle.clues.find((item) => item.id === cell.clueId);
          el.classList.toggle("selected", cell.clueId === state.selectedClueId);
          el.innerHTML = `<span class="clue-number">${clue.number}</span><span class="clue-arrow">${cell.direction === "across" ? "→" : "↓"}</span>`;
          el.addEventListener("click", () => selectClue(cell.clueId));
        } else {
          el.disabled = true;
          el.setAttribute("aria-hidden", "true");
        }

        board.appendChild(el);
      });
    });
  }

  function renderClue() {
    const clue = getActiveClue();
    if (!clue) return;
    clueNumber.textContent = String(clue.number);
    clueDirection.textContent = clue.direction === "across" ? "вправо" : "вниз";
    clueLength.textContent = formatLetters(clue.answer.length);
    clueText.textContent = `${clue.definition} · ${clue.category}`;
  }

  function updateStatus() {
    const solved = state.puzzle.clues.filter(isClueSolved).length;
    solvedCount.textContent = String(solved);
    mistakesCount.textContent = String(state.mistakes);

    if (solved === state.puzzle.clues.length) {
      showToast("Готово, сетка решена");
    haptic("notification", "success");
    }
  }

  function selectClue(clueId) {
    const clue = state.puzzle.clues.find((item) => item.id === clueId);
    state.selectedClueId = clueId;
    const firstEmpty = clue.cells.find((cell) => !state.entries[cellKey(cell)]) || clue.cells[0];
    state.selectedCellKey = cellKey(firstEmpty);
    state.checkedCells.clear();
    render();
  }

  function selectCell(row, col) {
    const key = `${row}:${col}`;
    const cell = state.puzzle.grid[row][col];
    if (cell.type !== "letter") return;
    if (!cell.clueIds.includes(state.selectedClueId)) {
      state.selectedClueId = cell.clueIds[0];
    }
    state.selectedCellKey = key;
    state.checkedCells.clear();
    render();
  }

  function enterLetter(letter) {
    const clue = getActiveClue();
    if (!clue || !state.selectedCellKey) return;
    state.entries[state.selectedCellKey] = normalizeAnswer(letter);
    state.checkedCells.delete(state.selectedCellKey);

    const currentIndex = clue.cells.findIndex((cell) => cellKey(cell) === state.selectedCellKey);
    const next = clue.cells.slice(currentIndex + 1).find((cell) => !state.entries[cellKey(cell)]);
    if (next) state.selectedCellKey = cellKey(next);
    render();
  }

  function eraseLetter() {
    if (!state.selectedCellKey) return;
    delete state.entries[state.selectedCellKey];
    state.checkedCells.delete(state.selectedCellKey);
    render();
  }

  function revealLetter() {
    const clue = getActiveClue();
    if (!clue) return;
    const target = clue.cells.find((cell) => {
      const key = cellKey(cell);
      return state.entries[key] !== state.puzzle.grid[cell.row][cell.col].letter;
    });
    if (!target) {
      showToast("В этом слове уже всё верно");
      return;
    }

    const key = cellKey(target);
    state.entries[key] = state.puzzle.grid[target.row][target.col].letter;
    state.selectedCellKey = key;
    state.checkedCells.set(key, "correct");
    haptic("impact", "light");
    render();
  }

  function checkPuzzle() {
    let wrong = 0;
    let filled = 0;
    state.checkedCells.clear();

    state.puzzle.clues.forEach((clue) => {
      clue.cells.forEach((cell) => {
        const key = cellKey(cell);
        const value = state.entries[key] || "";
        if (!value) return;
        filled += 1;
        const status = value === state.puzzle.grid[cell.row][cell.col].letter ? "correct" : "wrong";
        state.checkedCells.set(key, status);
        if (status === "wrong") wrong += 1;
      });
    });

    if (!filled) {
      showToast("Сначала впишите пару букв");
      return;
    }

    state.mistakes += wrong;
    if (wrong) {
      showToast(`${wrong} ${formatMistakes(wrong)}`);
      haptic("notification", "error");
    } else {
      showToast("Пока всё правильно");
      haptic("notification", "success");
    }

    render();
  }

  function onHardwareKey(event) {
    const raw = event.key;
    if (raw === "Backspace") {
      event.preventDefault();
      eraseLetter();
      return;
    }

    const letter = normalizeAnswer(raw);
    if (letter.length === 1 && LETTERS.includes(letter)) {
      event.preventDefault();
      enterLetter(letter);
    }
  }

  function isClueSolved(clue) {
    return clue.cells.every((cell) => state.entries[cellKey(cell)] === state.puzzle.grid[cell.row][cell.col].letter);
  }

  function getActiveClue() {
    return state.puzzle.clues.find((clue) => clue.id === state.selectedClueId);
  }

  function cellKey(cell) {
    return `${cell.row}:${cell.col}`;
  }

  function isLetter(grid, row, col) {
    return inBounds(row, col) && grid[row][col].type === "letter";
  }

  function inBounds(row, col) {
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function formatLetters(count) {
    const tail = count % 10;
    if (count > 10 && count < 20) return `${count} букв`;
    if (tail === 1) return `${count} буква`;
    if (tail >= 2 && tail <= 4) return `${count} буквы`;
    return `${count} букв`;
  }

  function formatMistakes(count) {
    const tail = count % 10;
    if (count > 10 && count < 20) return "ошибок";
    if (tail === 1) return "ошибка";
    if (tail >= 2 && tail <= 4) return "ошибки";
    return "ошибок";
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function haptic(kind, value) {
    if (!tg || !tg.HapticFeedback || typeof tg.isVersionAtLeast !== "function") return;
    if (!tg.isVersionAtLeast("6.1")) return;
    if (kind === "impact") tg.HapticFeedback.impactOccurred(value);
    if (kind === "notification") tg.HapticFeedback.notificationOccurred(value);
  }
})();
