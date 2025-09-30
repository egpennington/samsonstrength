const $ = (id) => document.getElementById(id)
const fmtMs = (ms) => {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`
}
const fmtSec1 = (s) => `${s.toFixed(1)}s`
const buzz = (p) => {
  try {
    navigator.vibrate && navigator.vibrate(p)
  } catch {}
}

// Theme
const themeBtn = $("themeBtn")
const root = document.documentElement
function applyTheme(mode) {
  root.setAttribute("data-theme", mode)
  themeBtn.textContent = mode === "dark" ? "Light Mode" : "Dark Mode"
  localStorage.setItem("lm-theme", mode)
}
applyTheme(localStorage.getItem("lm-theme") || "dark")
themeBtn.onclick = () => {
  const cur = root.getAttribute("data-theme")
  applyTheme(cur === "dark" ? "light" : "dark")
}

// Export
$("exportBtn").onclick = () => {
  const old = document.title
  const ex =
    $("summaryExercise").textContent || $("exercise").value || "Workout"
  const d = new Date().toISOString().slice(0, 10)
  const mode = $("summaryMode").textContent || "Ladder"
  document.title = `LadderWorkout_${d}_${ex}_${mode}`.replace(/ /g, "-")
  window.print()
  setTimeout(() => (document.title = old), 1000)
}

// Fullscreen
$("fsBtn").onclick = async () => {
  const el = document.documentElement
  if (!document.fullscreenElement) {
    await el.requestFullscreen()
  } else {
    await document.exitFullscreen()
  }
}

// Ding sound
let audioCtx = null
function ding() {
  if ($("soundToggle").value === "off") return
  try {
    if (!audioCtx)
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const o = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    o.type = "sine"
    o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.35, audioCtx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25)
    o.connect(g).connect(audioCtx.destination)
    o.start()
    o.stop(audioCtx.currentTime + 0.26)
  } catch {}
}

// Build plan
function buildPlan(max, mode) {
  const n = Math.max(1, max | 0)
  if (mode === "pyr") {
    const up = [...Array(n)].map((_, i) => i + 1)
    const down = [...Array(n - 1)].map((_, i) => n - 1 - i)
    return up.concat(down)
  }
  if (mode === "desc") {
    return [...Array(n)].map((_, i) => n - i)
  }
  return [...Array(n)].map((_, i) => i + 1)
}

// State & UI
const state = {
  running: false,
  paused: false,
  startEpoch: 0,
  pauseAccum: 0,
  phase: "idle",
  lastCueEpoch: 0,
  restEndEpoch: 0,
  plan: [],
  index: 0,
  restSeconds: 30,
  cumulativeEffortMs: 0,
  log: [],
}
const ui = {
  setupView: $("setupView"),
  workoutView: $("workoutView"),
  logView: $("logView"),
  beginBtn: $("beginBtn"),
  editBtn: $("editBtn"),
  totalTime: $("totalTime"),
  restCountdown: $("restCountdown"),
  currentSet: $("currentSet"),
  effortTime: $("effortTime"),
  cumulativeEffort: $("cumulativeEffort"),
  phaseLabel: $("phaseLabel"),
  progressFill: $("progressFill"),
  progressLabel: $("progressLabel"),
  planLabel: $("planLabel"),
  logBody: $("logBody"),
  startBtn: $("startBtn"),
  doneBtn: $("doneBtn"),
  pauseBtn: $("pauseBtn"),
  resetBtn: $("resetBtn"),
  exercise: $("exercise"),
  target: $("targetReps"),
  rest: $("restSeconds"),
  mode: $("ladderMode"),
  sound: $("soundToggle"),
  summaryExercise: $("summaryExercise"),
  summaryMode: $("summaryMode"),
  summaryTop: $("summaryTop"),
  summaryRest: $("summaryRest"),
}

function showSetup() {
  ui.setupView.hidden = false
  ui.workoutView.hidden = true
  ui.logView.hidden = true
}
function showWorkout() {
  ui.setupView.hidden = true
  ui.workoutView.hidden = false
  ui.logView.hidden = false
}

function updateProgress() {
  const total = state.plan.length || 1
  const done = state.index
  const pct = Math.round((100 * done) / total)
  ui.progressFill.style.width = pct + "%"
  ui.progressLabel.textContent = pct + "%"
  ui.planLabel.textContent = `Plan: ${total} set${total > 1 ? "s" : ""}`
}
function currentReps() {
  return state.plan[state.index] || 1
}

// Setup → Workout
function beginWorkoutFlow() {
  const ex = ui.exercise.value.trim() || "Workout"
  const top = Math.max(1, parseInt(ui.target.value || "10", 10))
  const rest = Math.max(1, parseInt(ui.rest.value || "30", 10))
  const mode = ui.mode.value
  localStorage.setItem(
    "lm-last",
    JSON.stringify({ ex, top, rest, mode, snd: ui.sound.value }),
  )
  state.plan = buildPlan(top, mode)
  state.restSeconds = rest
  state.index = 0
  state.cumulativeEffortMs = 0
  state.running = false
  state.paused = false
  state.phase = "idle"
  state.log = []
  ui.logBody.innerHTML = ""
  updateProgress()
  ui.summaryExercise.textContent = ex
  ui.summaryTop.textContent = String(top)
  ui.summaryRest.textContent = `${rest}s`
  ui.summaryMode.textContent =
    mode === "asc" ? "Ascend" : mode === "desc" ? "Descend" : "Pyramid"
  showWorkout()
  setTimeout(() => ui.startBtn.focus(), 50)
}

ui.beginBtn.onclick = beginWorkoutFlow
ui.editBtn.onclick = () => {
  resetCore()
  showSetup()
}

// Load last used inputs
;(function () {
  const last = JSON.parse(localStorage.getItem("lm-last") || "null")
  if (last) {
    ui.exercise.value = last.ex
    ui.target.value = last.top
    ui.rest.value = last.rest
    ui.mode.value = last.mode
    ui.sound.value = last.snd
  }
})()

// Ensure setup on first paint
document.addEventListener("DOMContentLoaded", showSetup)
;["exercise", "targetReps", "restSeconds"].forEach((id) =>
  $(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      beginWorkoutFlow()
    }
  }),
)

// Engine
let rafId
function tick() {
  if (!state.running) return
  const now = performance.now()
  const totalMs = now - state.startEpoch - state.pauseAccum
  ui.totalTime.textContent = fmtMs(totalMs)
  if (state.phase === "effort") {
    ui.effortTime.textContent = fmtSec1((now - state.lastCueEpoch) / 1000)
  }
  if (state.phase === "rest") {
    const remain = Math.max(0, state.restEndEpoch - now)
    const sec = Math.floor(remain / 1000)
    ui.restCountdown.textContent = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`
    if (remain <= 0) startEffort()
  }
  rafId = requestAnimationFrame(tick)
}

function startWorkout() {
  if (state.plan.length === 0) {
    beginWorkoutFlow()
    return
  }
  resetCore(false)
  state.running = true
  state.paused = false
  state.startEpoch = performance.now()
  state.pauseAccum = 0
  state.index = 0
  state.phase = "effort"
  ui.currentSet.textContent = currentReps()
  ui.phaseLabel.textContent = `effort — ${currentReps()} rep${currentReps() > 1 ? "s" : ""}`
  state.lastCueEpoch = performance.now()
  ding()
  buzz(60)
  ui.doneBtn.disabled = false
  ui.pauseBtn.disabled = false
  updateProgress()
  tick()
}
function startEffort() {
  if (!state.running || state.index >= state.plan.length) return
  state.phase = "effort"
  ui.phaseLabel.textContent = `effort — ${currentReps()} rep${currentReps() > 1 ? "s" : ""}`
  state.lastCueEpoch = performance.now()
  ding()
  buzz(60)
  ui.doneBtn.disabled = false
}
function startRest() {
  state.phase = "rest"
  ui.phaseLabel.textContent = "rest"
  state.restEndEpoch = performance.now() + state.restSeconds * 1000
  ui.doneBtn.disabled = true
}
function completeSet() {
  if (state.phase !== "effort") return
  const now = performance.now()
  const effort = now - state.lastCueEpoch
  const tr = document.createElement("tr")
  tr.innerHTML = `
  <td>#${state.log.length + 1}</td>
  <td>${currentReps()}</td>
  <td>${fmtSec1(effort / 1000)}</td>
  <td>${fmtMs(now - state.startEpoch)}</td>
`
  ui.logBody.appendChild(tr)
  state.log.push({
    reps: currentReps(),
    effortMs: effort,
    at: now - state.startEpoch - state.pauseAccum,
  })
  state.cumulativeEffortMs += effort
  ui.cumulativeEffort.textContent = fmtMs(state.cumulativeEffortMs)
  state.index++
  updateProgress()
  buzz([40, 40, 40])
  if (state.index >= state.plan.length) {
    finishWorkout()
    return
  }
  ui.currentSet.textContent = currentReps()
  startRest()
}
function finishWorkout() {
  ui.phaseLabel.textContent = "complete ✅"
  ui.doneBtn.disabled = true
  ui.pauseBtn.disabled = true
  state.running = false
  cancelAnimationFrame(rafId)
  ding()
  buzz([100, 50, 100])
}
function pauseResume() {
  if (!state.running) return
  if (!state.paused) {
    state.paused = true
    state.pauseStart = performance.now()
    ui.phaseLabel.textContent = "paused"
    ui.doneBtn.disabled = true
    ui.pauseBtn.textContent = "Resume"
    cancelAnimationFrame(rafId)
  } else {
    const delta = performance.now() - state.pauseStart
    state.pauseAccum += delta
    if (state.phase === "effort") state.lastCueEpoch += delta
    if (state.phase === "rest") state.restEndEpoch += delta
    state.paused = false
    ui.pauseBtn.textContent = "Pause"
    tick()
    ui.doneBtn.disabled = state.phase !== "effort"
  }
}
function resetCore() {
  cancelAnimationFrame(rafId)
  state.running = false
  state.paused = false
  state.phase = "idle"
  ui.totalTime.textContent = "00:00.0"
  ui.restCountdown.textContent = "--:--"
  ui.currentSet.textContent = "1"
  ui.effortTime.textContent = "00.0s"
  ui.cumulativeEffort.textContent = "00:00.0"
  state.log = []
  ui.logBody.innerHTML = ""
  ui.progressFill.style.width = "0%"
  ui.progressLabel.textContent = "0%"
  ui.planLabel.textContent = "Plan: 0 sets"
  ui.doneBtn.disabled = true
  ui.pauseBtn.disabled = true
}
function showWorkout() {
  ui.setupView.hidden = true
  ui.workoutView.hidden = false
  ui.logView.hidden = false
  document.body.classList.add("is-workout") // <—
}
function showSetup() {
  ui.setupView.hidden = false
  ui.workoutView.hidden = true
  ui.logView.hidden = true
  document.body.classList.remove("is-workout") // <—
}

// Wire controls
ui.startBtn.onclick = startWorkout
ui.doneBtn.onclick = completeSet
ui.pauseBtn.onclick = pauseResume
ui.resetBtn.onclick = () => resetCore

// Shortcuts (only on workout screen)
window.addEventListener("keydown", (e) => {
  if (e.repeat || ui.workoutView.hidden) return
  const k = e.key.toLowerCase()
  if (k === " ") {
    e.preventDefault()
    completeSet()
  }
  if (k === "p") {
    e.preventDefault()
    pauseResume()
  }
  if (k === "r") {
    e.preventDefault()
    resetCore()
  }
  if (k === "s") {
    e.preventDefault()
    startWorkout()
  }
})

// PWA: register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  });
}