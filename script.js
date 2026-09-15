"use strict";

// =========================
// PENGATURAN LAYAR
// =========================
const GRID_SIZE = 20;
const TINGGI_HEADER = 45;
const MIN_LEBAR = 320;
const MIN_TINGGI = 480;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let LEBAR = 800;
let TINGGI = 600;

// =========================
// WARNA
// =========================
const BACKGROUND = "rgb(12,8,15)";
const GRID = "rgb(35,18,32)";

const PINK = "rgb(255,90,170)";
const UNGU = "rgb(190,90,220)";
const BIRU = "rgb(120,170,255)";
const KUNING = "rgb(255,210,90)";
const ORANYE = "rgb(255,145,100)";
const HIJAU = "rgb(255,105,180)";

const PUTIH = "rgb(255,255,255)";
const HITAM = "rgb(10,6,12)";
const ABU = "rgb(190,170,185)";
const TOMBOL_ABU = "rgb(60,55,65)";

const warna_pelangi = [PINK, UNGU, BIRU, KUNING, ORANYE, HIJAU];

// =========================
// UKURAN LAYAR RESPONSIF
// =========================
function sesuaikanUkuranLayar() {
  let w = Math.max(window.innerWidth, MIN_LEBAR);
  let h = Math.max(window.innerHeight, MIN_TINGGI);

  w = Math.floor(w / GRID_SIZE) * GRID_SIZE;
  h = Math.floor(h / GRID_SIZE) * GRID_SIZE;

  LEBAR = w;
  TINGGI = h;

  canvas.width = LEBAR;
  canvas.height = TINGGI;
}
sesuaikanUkuranLayar();
window.addEventListener("resize", sesuaikanUkuranLayar);

function skalaFont() {
  return Math.max(0.6, Math.min(1.5, LEBAR / 800));
}

// =========================
// STATE MESIN GAME
// =========================
let layarAktif = "loading"; // loading, start, playing, gameover
let waktuMulaiLoading = performance.now();

let snakeBody = [];
let arah = { x: GRID_SIZE, y: 0 };
let makananList = [];
let skor = 0;

let shiftKeyboard = false;
let shiftTouch = false;
let shiftMouseHeld = false;
let shiftTouchId = null;

let waktuTambah = 0;
const DURASI_EFEK = 200;

let indexWarna = 0;
let waktuWarna = performance.now();
let tahapSebelumnya = 0;

let akumulatorWaktu = 0;
let waktuFrameSebelumnya = null;

// Efek makanan spesial yang sedang aktif: { tipe: 'glow'|'freeze'|'poison', mulai, durasi }
let efekAktif = null;
const DURASI_EFEK_SPESIAL = 5000;

// =========================
// UTIL
// =========================
function acakInt(min, maxExclusive, step) {
  const jumlahLangkah = Math.floor((maxExclusive - min) / step);
  return min + Math.floor(Math.random() * jumlahLangkah) * step;
}

function rectsOverlap(a, b) {
  return a.x < b.x + GRID_SIZE && a.x + GRID_SIZE > b.x &&
         a.y < b.y + GRID_SIZE && a.y + GRID_SIZE > b.y;
}

// =========================
// TIPE & KELANGKAAN MAKANAN
// =========================
// Makanan spesial dibuat langka: hanya boleh ada 1 makanan spesial di papan
// dalam satu waktu, dan peluang munculnya kecil setiap kali slot diisi ulang.
function pilihTipeMakanan(existingList) {
  const adaSpesial = existingList.some(m => m.tipe !== "normal");
  if (adaSpesial) return "normal";

  const roll = Math.random();
  if (roll < 0.05) return "glow";
  if (roll < 0.10) return "freeze";
  if (roll < 0.15) return "poison";
  return "normal";
}

// Variasi bentuk untuk makanan normal
const BENTUK_NORMAL = ["bulat", "bintang", "daun", "air", "hati", "berlian"];
function pilihBentukNormal() {
  return BENTUK_NORMAL[Math.floor(Math.random() * BENTUK_NORMAL.length)];
}

// =========================
// MEMBUAT MAKANAN
// =========================
function buatMakanan(snake, existing, tipe) {
  while (true) {
    const x = acakInt(0, LEBAR, GRID_SIZE);
    const y = acakInt(TINGGI_HEADER + 15, TINGGI, GRID_SIZE);
    const baru = { x, y, tipe: tipe || "normal" };
    if (baru.tipe === "normal") {
      baru.bentuk = pilihBentukNormal();
    }

    const kenaUlar = snake.some(seg => rectsOverlap(baru, { x: seg.x, y: seg.y }));
    const kenaMakanan = existing.some(m => rectsOverlap(baru, m));

    if (!kenaUlar && !kenaMakanan) return baru;
  }
}

function buatSemuaMakanan(snake) {
  const list = [];
  for (let i = 0; i < 8; i++) {
    const tipe = pilihTipeMakanan(list);
    list.push(buatMakanan(snake, list, tipe));
  }
  return list;
}

// =========================
// RESET GAME
// =========================
function resetGame() {
  const pusatX = Math.floor((LEBAR / 2) / GRID_SIZE) * GRID_SIZE;
  const pusatY = Math.floor((TINGGI / 2) / GRID_SIZE) * GRID_SIZE;

  snakeBody = [
    { x: pusatX, y: pusatY },
    { x: pusatX - GRID_SIZE, y: pusatY },
    { x: pusatX - 2 * GRID_SIZE, y: pusatY }
  ];
  arah = { x: GRID_SIZE, y: 0 };
  makananList = buatSemuaMakanan(snakeBody);
  skor = 0;
  efekAktif = null;
}

function mulaiUlang() {
  resetGame();
  layarAktif = "playing";
  shiftKeyboard = false;
  shiftTouch = false;
  shiftTouchId = null;
  shiftMouseHeld = false;
  waktuTambah = 0;
  indexWarna = 0;
  waktuWarna = performance.now();
  tahapSebelumnya = 0;
  akumulatorWaktu = 0;
}

// =========================
// WARNA ULAR
// =========================
function tentukanWarna(s) {
  const tahap = Math.floor(s / 5) % 4;
  if (tahap === 0) return PINK;
  if (tahap === 1) return UNGU;
  if (tahap === 2) return BIRU;
  return "warna_warni";
}

// =========================
// TOMBOL (klik / tap)
// =========================
function ukuranFontTombol(rect, teks) {
  let ukuran = Math.floor(rect.h * 0.42);
  ukuran = Math.max(14, Math.min(26, ukuran));

  ctx.font = `bold ${ukuran}px sans-serif`;
  let lebarTeks = ctx.measureText(teks).width;
  const maxLebar = rect.w - 24;

  while (lebarTeks > maxLebar && ukuran > 10) {
    ukuran -= 1;
    ctx.font = `bold ${ukuran}px sans-serif`;
    lebarTeks = ctx.measureText(teks).width;
  }
  return ukuran;
}

function gambarTombol(rect, teks, warnaDasar, mouse, warnaTeks) {
  warnaTeks = warnaTeks || PUTIH;
  const hover = mouse && titikDalamRect(mouse, rect);

  ctx.fillStyle = hover ? terangkan(warnaDasar, 30) : warnaDasar;
  roundRect(rect.x, rect.y, rect.w, rect.h, 14);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = PUTIH;
  roundRect(rect.x, rect.y, rect.w, rect.h, 14);
  ctx.stroke();

  const ukuranFont = ukuranFontTombol(rect, teks);
  ctx.fillStyle = warnaTeks;
  ctx.font = `bold ${ukuranFont}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(teks, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function terangkan(rgbStr, jumlah) {
  const m = rgbStr.match(/\d+/g).map(Number);
  return `rgb(${m.map(c => Math.min(255, c + jumlah)).join(",")})`;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function titikDalamRect(p, rect) {
  return p.x >= rect.x && p.x <= rect.x + rect.w &&
         p.y >= rect.y && p.y <= rect.y + rect.h;
}

// =========================
// TOMBOL GAME OVER (posisi)
// =========================
function dapatkanTombolGameOver() {
  const tinggiTombol = 54;

  if (LEBAR < 480) {
    const lebarTombol = Math.min(240, Math.floor(LEBAR * 0.7));
    const y1 = Math.floor(TINGGI * 0.60);
    const y2 = y1 + tinggiTombol + 16;

    return [
      { x: LEBAR / 2 - lebarTombol / 2, y: y1, w: lebarTombol, h: tinggiTombol },
      { x: LEBAR / 2 - lebarTombol / 2, y: y2, w: lebarTombol, h: tinggiTombol }
    ];
  } else {
    const lebarTombol = Math.min(180, Math.floor(LEBAR * 0.22));
    const jarak = 20;
    const totalLebar = lebarTombol * 2 + jarak;
    const xAwal = LEBAR / 2 - totalLebar / 2;
    const y = Math.floor(TINGGI * 0.62);

    return [
      { x: xAwal, y, w: lebarTombol, h: tinggiTombol },
      { x: xAwal + lebarTombol + jarak, y, w: lebarTombol, h: tinggiTombol }
    ];
  }
}

// =========================
// KONTROL MOBILE (D-PAD + LARI)
// =========================
function dapatkanKontrolMobile() {
  const ukuran = Math.max(46, Math.min(64, Math.floor(Math.min(LEBAR, TINGGI) * 0.09)));
  const gap = Math.max(4, Math.floor(ukuran * 0.15));
  const margin = Math.floor(ukuran * 0.5);

  const pusatX = margin + ukuran + gap;
  const pusatY = TINGGI - margin - ukuran - gap;

  const buatRect = (cx, cy, s) => ({ x: cx - s / 2, y: cy - s / 2, w: s, h: s });

  const atas = buatRect(pusatX, pusatY - ukuran - gap, ukuran);
  const bawah = buatRect(pusatX, pusatY + ukuran + gap, ukuran);
  const kiri = buatRect(pusatX - ukuran - gap, pusatY, ukuran);
  const kanan = buatRect(pusatX + ukuran + gap, pusatY, ukuran);

  const ukuranShift = Math.floor(ukuran * 1.35);
  const shift = buatRect(
    LEBAR - margin - ukuranShift / 2,
    TINGGI - margin - ukuranShift / 2,
    ukuranShift
  );

  return { atas, bawah, kiri, kanan, shift };
}

function gambarKontrolMobile(kontrol, shiftAktif) {
  const panah = (rect, arahPanah) => {
    ctx.beginPath();
    ctx.arc(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w / 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.stroke();

    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const s = rect.w * 0.22;
    let titik;
    if (arahPanah === "atas") titik = [[cx, cy - s], [cx - s, cy + s * 0.6], [cx + s, cy + s * 0.6]];
    else if (arahPanah === "bawah") titik = [[cx, cy + s], [cx - s, cy - s * 0.6], [cx + s, cy - s * 0.6]];
    else if (arahPanah === "kiri") titik = [[cx - s, cy], [cx + s * 0.6, cy - s], [cx + s * 0.6, cy + s]];
    else titik = [[cx + s, cy], [cx - s * 0.6, cy - s], [cx - s * 0.6, cy + s]];

    ctx.beginPath();
    ctx.moveTo(titik[0][0], titik[0][1]);
    ctx.lineTo(titik[1][0], titik[1][1]);
    ctx.lineTo(titik[2][0], titik[2][1]);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fill();
  };

  panah(kontrol.atas, "atas");
  panah(kontrol.bawah, "bawah");
  panah(kontrol.kiri, "kiri");
  panah(kontrol.kanan, "kanan");

  const rs = kontrol.shift;
  ctx.beginPath();
  ctx.arc(rs.x + rs.w / 2, rs.y + rs.h / 2, rs.w / 2, 0, Math.PI * 2);
  ctx.fillStyle = shiftAktif ? "rgba(255,255,255,0.62)" : "rgba(255,90,170,0.35)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.58)";
  ctx.stroke();

  ctx.fillStyle = shiftAktif ? HITAM : PUTIH;
  ctx.font = `${Math.round(30 * skalaFont())}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("LARI", rs.x + rs.w / 2, rs.y + rs.h / 2);

  // Indikator kecil arah kiri/kanan terbalik saat efek racun (mirror) aktif
  if (efekMirrorAktif()) {
    ctx.fillStyle = "rgba(190,90,220,0.9)";
    ctx.font = `bold ${Math.round(14 * skalaFont())}px sans-serif`;
    ctx.fillText("×", kontrol.kiri.x + kontrol.kiri.w / 2, kontrol.kiri.y - kontrol.kiri.h / 2 + 4);
    ctx.fillText("×", kontrol.kanan.x + kontrol.kanan.w / 2, kontrol.kanan.y - kontrol.kanan.h / 2 + 4);
  }
}

// =========================
// BACKGROUND
// =========================
function gambarBackground() {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, LEBAR, TINGGI);

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  for (let x = 0; x < LEBAR; x += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, TINGGI);
    ctx.stroke();
  }
  for (let y = 0; y < TINGGI; y += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(LEBAR, y + 0.5);
    ctx.stroke();
  }
}

// =========================
// INPUT (dengan dukungan efek mirror/racun)
// =========================
let mousePos = { x: -1, y: -1 };

function efekMirrorAktif() {
  return !!(efekAktif && efekAktif.tipe === "poison");
}

// Menerapkan arah yang diminta ('atas'|'bawah'|'kiri'|'kanan'), dibalik
// otomatis untuk kiri/kanan jika efek racun (mirror) sedang aktif.
function terapkanArah(arahDiminta) {
  let a = arahDiminta;
  if (efekMirrorAktif()) {
    if (a === "kiri") a = "kanan";
    else if (a === "kanan") a = "kiri";
  }

  let vektor;
  if (a === "atas") vektor = { x: 0, y: -GRID_SIZE };
  else if (a === "bawah") vektor = { x: 0, y: GRID_SIZE };
  else if (a === "kiri") vektor = { x: -GRID_SIZE, y: 0 };
  else vektor = { x: GRID_SIZE, y: 0 };

  // Cegah membalik arah 180 derajat ke badan sendiri
  if (vektor.x === -arah.x && vektor.y === -arah.y) return;
  arah = vektor;
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Shift") shiftKeyboard = true;

  if (e.key === " ") {
    if (layarAktif === "start" || layarAktif === "gameover") mulaiUlang();
    e.preventDefault();
  }
  if (e.key === "Escape") {
    if (layarAktif === "playing" || layarAktif === "gameover") layarAktif = "start";
  }

  if (layarAktif !== "playing") return;

  const key = e.key.toLowerCase();
  if (key === "arrowup" || key === "w") terapkanArah("atas");
  else if (key === "arrowdown" || key === "s") terapkanArah("bawah");
  else if (key === "arrowleft" || key === "a") terapkanArah("kiri");
  else if (key === "arrowright" || key === "d") terapkanArah("kanan");
});

window.addEventListener("keyup", (e) => {
  if (e.key === "Shift") shiftKeyboard = false;
});

function posisiDariEvent(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

canvas.addEventListener("mousemove", (e) => {
  mousePos = posisiDariEvent(e);
});

canvas.addEventListener("mousedown", (e) => {
  const p = posisiDariEvent(e);
  tanganiKlik(p);
  if (layarAktif === "playing") {
    const kontrol = dapatkanKontrolMobile();
    if (titikDalamRect(p, kontrol.shift)) shiftMouseHeld = true;
  }
});
canvas.addEventListener("mouseup", () => { shiftMouseHeld = false; });

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  for (const t of e.changedTouches) {
    const p = { x: t.clientX - rect.left, y: t.clientY - rect.top };
    tanganiKlik(p);
    if (layarAktif === "playing") {
      const kontrol = dapatkanKontrolMobile();
      if (titikDalamRect(p, kontrol.shift)) {
        shiftTouch = true;
        shiftTouchId = t.identifier;
      }
    }
  }
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  for (const t of e.changedTouches) {
    if (shiftTouchId === t.identifier) {
      shiftTouch = false;
      shiftTouchId = null;
    }
  }
}, { passive: false });

function tanganiKlik(p) {
  if (layarAktif === "start") {
    const tombol = tombolStartRect();
    if (titikDalamRect(p, tombol)) mulaiUlang();
    return;
  }

  if (layarAktif === "playing") {
    const kontrol = dapatkanKontrolMobile();
    if (titikDalamRect(p, kontrol.atas)) terapkanArah("atas");
    else if (titikDalamRect(p, kontrol.bawah)) terapkanArah("bawah");
    else if (titikDalamRect(p, kontrol.kiri)) terapkanArah("kiri");
    else if (titikDalamRect(p, kontrol.kanan)) terapkanArah("kanan");
    return;
  }

  if (layarAktif === "gameover") {
    const [restartRect, quitRect] = dapatkanTombolGameOver();
    if (titikDalamRect(p, restartRect)) mulaiUlang();
    else if (titikDalamRect(p, quitRect)) layarAktif = "start";
  }
}

function tombolStartRect() {
  const lebarTombol = Math.min(260, Math.floor(LEBAR * 0.6));
  const tinggiTombol = 60;
  return {
    x: LEBAR / 2 - lebarTombol / 2,
    y: Math.floor(TINGGI * 0.62) - tinggiTombol / 2,
    w: lebarTombol,
    h: tinggiTombol
  };
}

// =========================
// GAMBAR: LOADING
// =========================
function gambarLoading(waktu) {
  waktu = Math.max(0, waktu);
  ctx.fillStyle = HITAM;
  ctx.fillRect(0, 0, LEBAR, TINGGI);

  const radiusKecil = Math.floor(Math.min(LEBAR, TINGGI) * 0.13);
  const radiusBesar = Math.floor(Math.min(LEBAR, TINGGI) * 0.16);

  ctx.fillStyle = "rgb(45,15,35)";
  ctx.beginPath();
  ctx.arc(LEBAR * 0.12, TINGGI * 0.17, radiusKecil, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(LEBAR * 0.88, TINGGI * 0.83, radiusBesar, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = PINK;
  ctx.font = `bold ${Math.round(60 * skalaFont())}px sans-serif`;
  ctx.textAlign = "center";
  const yJudul = TINGGI * 0.30;
  ctx.textBaseline = "top";
  ctx.fillText("CUTE SNAKE", LEBAR / 2, yJudul);

  const jumlahTitik = Math.floor(waktu / 400) % 4;
  const titik = ".".repeat(jumlahTitik);
  ctx.fillStyle = PUTIH;
  ctx.font = `${Math.round(28 * skalaFont())}px sans-serif`;
  ctx.fillText("Sedang menyiapkan game" + titik, LEBAR / 2, yJudul + 70 * skalaFont());

  const pusatUlarY = TINGGI * 0.55;
  const jarakBulat = Math.max(18, Math.floor(LEBAR * 0.035));
  const xAwal = LEBAR / 2 - jarakBulat;

  ctx.fillStyle = PINK;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(xAwal + i * jarakBulat, pusatUlarY, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  const mataX = xAwal + 2 * jarakBulat + 4;
  ctx.fillStyle = PUTIH;
  ctx.beginPath(); ctx.arc(mataX, pusatUlarY - 4, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mataX, pusatUlarY + 4, 3, 0, Math.PI * 2); ctx.fill();

  const lebarBar = Math.floor(LEBAR * 0.4);
  const xBar = LEBAR / 2 - lebarBar / 2;
  const yBar = TINGGI * 0.68;
  const progress = Math.min(waktu / 4000, 1);

  ctx.fillStyle = "rgb(55,25,45)";
  roundRect(xBar, yBar, lebarBar, 16, 8); ctx.fill();
  ctx.fillStyle = PINK;
  roundRect(xBar, yBar, lebarBar * progress, 16, 8); ctx.fill();
}

// =========================
// GAMBAR: START
// =========================
function gambarStart() {
  ctx.fillStyle = HITAM;
  ctx.fillRect(0, 0, LEBAR, TINGGI);

  ctx.fillStyle = "rgb(45,15,35)";
  ctx.beginPath();
  ctx.arc(LEBAR * 0.1, TINGGI * 0.12, Math.floor(Math.min(LEBAR, TINGGI) * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(LEBAR * 0.9, TINGGI * 0.9, Math.floor(Math.min(LEBAR, TINGGI) * 0.15), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = PINK;
  ctx.font = `bold ${Math.round(60 * skalaFont())}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const yJudul = TINGGI * 0.26;
  ctx.fillText("CUTE SNAKE", LEBAR / 2, yJudul);

  ctx.fillStyle = ABU;
  ctx.font = `${Math.round(28 * skalaFont())}px sans-serif`;
  ctx.fillText("Kumpulkan makanan, hindari nabrak dinding & badan sendiri", LEBAR / 2, yJudul + 75 * skalaFont());

  const tombol = tombolStartRect();
  gambarTombol(tombol, "MULAI (START)", PINK, mousePos, HITAM);

  ctx.fillStyle = ABU;
  ctx.font = `${Math.round(20 * skalaFont())}px sans-serif`;
  ctx.fillText("Panah / WASD gerak  •  SHIFT lari", LEBAR / 2, tombol.y + tombol.h + 25);
  ctx.fillText("Klik / Tap tombol di atas, atau tekan SPACE", LEBAR / 2, tombol.y + tombol.h + 25 + 30 * skalaFont());

  ctx.fillStyle = KUNING;
  ctx.fillText("⚡ Glow: efek cahaya   🧊 Freeze: perlambat   🍄 Poison: kontrol terbalik", LEBAR / 2, tombol.y + tombol.h + 25 + 64 * skalaFont());
}

// =========================
// UPDATE LOGIKA GAME
// =========================
function updateGame() {
  const kepala = snakeBody[0];
  const kepalaBaru = { x: kepala.x + arah.x, y: kepala.y + arah.y };

  snakeBody.unshift(kepalaBaru);

  let makan = false;
  for (let i = 0; i < makananList.length; i++) {
    if (rectsOverlap(kepalaBaru, makananList[i])) {
      skor += 1;
      waktuTambah = performance.now();

      const tipeDimakan = makananList[i].tipe;
      if (tipeDimakan !== "normal") {
        efekAktif = { tipe: tipeDimakan, mulai: performance.now(), durasi: DURASI_EFEK_SPESIAL };
      }

      makananList.splice(i, 1);
      const tipeBaru = pilihTipeMakanan(makananList);
      makananList.push(buatMakanan(snakeBody, makananList, tipeBaru));
      makan = true;
      break;
    }
  }

  if (!makan) snakeBody.pop();

  if (
    kepalaBaru.x < 0 || kepalaBaru.x >= LEBAR ||
    kepalaBaru.y < TINGGI_HEADER || kepalaBaru.y >= TINGGI
  ) {
    layarAktif = "gameover";
  }

  for (let i = 1; i < snakeBody.length; i++) {
    if (snakeBody[i].x === kepalaBaru.x && snakeBody[i].y === kepalaBaru.y) {
      layarAktif = "gameover";
      break;
    }
  }
}

// =========================
// BENTUK MAKANAN NORMAL
// =========================
function gambarBulat(px, py, radius) {
  ctx.fillStyle = PINK;
  ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = PUTIH;
  ctx.beginPath(); ctx.arc(px - 3, py - 3, 2, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = HITAM;
  ctx.beginPath(); ctx.arc(px - 4, py, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px + 4, py, 2, 0, Math.PI * 2); ctx.fill();
}

function gambarBintangEmpatSisi(px, py, radius, warna) {
  const luar = radius * 1.15;
  const dalam = radius * 0.42;

  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const sudut = (Math.PI / 4) * i - Math.PI / 2;
    const r = i % 2 === 0 ? luar : dalam;
    const x = px + Math.cos(sudut) * r;
    const y = py + Math.sin(sudut) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = warna;
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath(); ctx.arc(px - radius * 0.2, py - radius * 0.2, radius * 0.18, 0, Math.PI * 2); ctx.fill();
}

function gambarDaun(px, py, radius, warna) {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI / 4);

  ctx.beginPath();
  ctx.moveTo(0, -radius * 1.1);
  ctx.quadraticCurveTo(radius * 1.1, 0, 0, radius * 1.1);
  ctx.quadraticCurveTo(-radius * 1.1, 0, 0, -radius * 1.1);
  ctx.closePath();
  ctx.fillStyle = warna;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -radius * 0.85);
  ctx.lineTo(0, radius * 0.85);
  ctx.stroke();

  ctx.restore();
}

function gambarAir(px, py, radius, warna) {
  ctx.beginPath();
  ctx.moveTo(px, py - radius * 1.15);
  ctx.bezierCurveTo(px + radius * 1.05, py - radius * 0.15, px + radius * 0.65, py + radius * 1.05, px, py + radius * 1.05);
  ctx.bezierCurveTo(px - radius * 0.65, py + radius * 1.05, px - radius * 1.05, py - radius * 0.15, px, py - radius * 1.15);
  ctx.closePath();
  ctx.fillStyle = warna;
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath(); ctx.arc(px - radius * 0.28, py, radius * 0.2, 0, Math.PI * 2); ctx.fill();
}

function gambarHati(px, py, radius, warna) {
  const r = radius * 0.62;
  ctx.fillStyle = warna;
  ctx.beginPath();
  ctx.arc(px - r * 0.55, py - r * 0.25, r, 0, Math.PI * 2);
  ctx.arc(px + r * 0.55, py - r * 0.25, r, 0, Math.PI * 2);
  ctx.moveTo(px - r * 1.55, py - r * 0.05);
  ctx.lineTo(px, py + r * 1.5);
  ctx.lineTo(px + r * 1.55, py - r * 0.05);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath(); ctx.arc(px - r * 0.7, py - r * 0.45, r * 0.28, 0, Math.PI * 2); ctx.fill();
}

function gambarBerlian(px, py, radius, warna) {
  ctx.beginPath();
  ctx.moveTo(px, py - radius * 1.15);
  ctx.lineTo(px + radius * 0.8, py - radius * 0.2);
  ctx.lineTo(px, py + radius * 1.15);
  ctx.lineTo(px - radius * 0.8, py - radius * 0.2);
  ctx.closePath();
  ctx.fillStyle = warna;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px - radius * 0.8, py - radius * 0.2);
  ctx.lineTo(px, py - radius * 0.45);
  ctx.lineTo(px + radius * 0.8, py - radius * 0.2);
  ctx.stroke();
}

function gambarMakananNormal(m, px, py, radius) {
  if (m.bentuk === "bintang") {
    gambarBintangEmpatSisi(px, py, radius, "rgb(255,225,90)");
  } else if (m.bentuk === "daun") {
    gambarDaun(px, py, radius, "rgb(120,205,120)");
  } else if (m.bentuk === "air") {
    gambarAir(px, py, radius, "rgb(110,180,255)");
  } else if (m.bentuk === "hati") {
    gambarHati(px, py, radius, "rgb(255,110,150)");
  } else if (m.bentuk === "berlian") {
    gambarBerlian(px, py, radius, "rgb(150,235,235)");
  } else {
    gambarBulat(px, py, radius);
  }
}

// =========================
// BENTUK MAKANAN SPESIAL (efek glow tetap dipertahankan)
// =========================
function gambarPetir(px, py, radius, warna) {
  ctx.beginPath();
  ctx.moveTo(px + radius * 0.15, py - radius * 1.2);
  ctx.lineTo(px - radius * 0.55, py + radius * 0.15);
  ctx.lineTo(px - radius * 0.05, py + radius * 0.15);
  ctx.lineTo(px - radius * 0.3, py + radius * 1.2);
  ctx.lineTo(px + radius * 0.65, py - radius * 0.05);
  ctx.lineTo(px + radius * 0.1, py - radius * 0.05);
  ctx.closePath();
  ctx.fillStyle = warna;
  ctx.fill();
}

function gambarEsBatu(px, py, radius, warna) {
  const s = radius * 1.5;
  roundRect(px - s / 2, py - s / 2, s, s, 4);
  ctx.fillStyle = warna;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1.5;
  roundRect(px - s / 2, py - s / 2, s, s, 4);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px - s * 0.32, py - s * 0.35);
  ctx.lineTo(px + s * 0.12, py - s * 0.05);
  ctx.lineTo(px + s * 0.12, py + s * 0.38);
  ctx.stroke();
}

function gambarJamur(px, py, radius, warnaTopi) {
  const lebarBatang = radius * 0.75;
  const tinggiBatang = radius * 1.05;
  ctx.fillStyle = "rgb(250,240,225)";
  roundRect(px - lebarBatang / 2, py - tinggiBatang * 0.05, lebarBatang, tinggiBatang, 3);
  ctx.fill();

  ctx.fillStyle = warnaTopi;
  ctx.beginPath();
  ctx.ellipse(px, py - radius * 0.15, radius * 1.15, radius * 0.9, 0, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath(); ctx.arc(px - radius * 0.45, py - radius * 0.5, radius * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px + radius * 0.4, py - radius * 0.55, radius * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px, py - radius * 0.8, radius * 0.1, 0, Math.PI * 2); ctx.fill();
}

// =========================
// GAMBAR MAKANAN (normal & spesial)
// =========================
function gambarMakanan(m) {
  const px = m.x + GRID_SIZE / 2;
  const py = m.y + GRID_SIZE / 2;
  const radius = GRID_SIZE / 2 - 1;

  if (m.tipe === "normal") {
    gambarMakananNormal(m, px, py, radius);
    return;
  }

  // Makanan spesial: berdenyut dengan aura bercahaya, tampil langka
  const denyut = 0.5 + 0.5 * Math.sin(performance.now() / 180);
  let warnaInti, warnaAuraRgb;
  if (m.tipe === "glow") { warnaInti = KUNING; warnaAuraRgb = "255,210,90"; }
  else if (m.tipe === "freeze") { warnaInti = BIRU; warnaAuraRgb = "120,170,255"; }
  else { warnaInti = UNGU; warnaAuraRgb = "190,90,220"; }

  ctx.save();
  ctx.shadowColor = warnaInti;
  ctx.shadowBlur = 10 + denyut * 10;

  ctx.fillStyle = `rgba(${warnaAuraRgb},${0.25 + denyut * 0.2})`;
  ctx.beginPath(); ctx.arc(px, py, radius + 4 + denyut * 2, 0, Math.PI * 2); ctx.fill();

  if (m.tipe === "glow") {
    gambarPetir(px, py, radius, warnaInti);
  } else if (m.tipe === "freeze") {
    gambarEsBatu(px, py, radius, warnaInti);
  } else {
    gambarJamur(px, py, radius, warnaInti);
  }

  ctx.restore();
}

// =========================
// GAMBAR BAR EFEK AKTIF
// =========================
function gambarEfekBar() {
  if (!efekAktif) return;

  const now = performance.now();
  const sisa = Math.max(0, efekAktif.durasi - (now - efekAktif.mulai));
  const persen = sisa / efekAktif.durasi;

  let warna, label;
  if (efekAktif.tipe === "glow") { warna = KUNING; label = "⚡ GLOW"; }
  else if (efekAktif.tipe === "freeze") { warna = BIRU; label = "🧊 FREEZE"; }
  else { warna = UNGU; label = "🍄 MIRROR"; }

  const kecil = LEBAR < 380;
  const lebarPil = Math.min(190, Math.floor(LEBAR * 0.5));
  const tinggiPil = 22;
  const xPil = LEBAR / 2 - lebarPil / 2;
  const yPil = kecil ? TINGGI_HEADER + 6 : (TINGGI_HEADER - tinggiPil) / 2;

  ctx.save();
  roundRect(xPil, yPil, lebarPil, tinggiPil, tinggiPil / 2);
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(xPil, yPil, lebarPil, tinggiPil);
  ctx.fillStyle = warna;
  ctx.fillRect(xPil, yPil, lebarPil * persen, tinggiPil);
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1.5;
  roundRect(xPil, yPil, lebarPil, tinggiPil, tinggiPil / 2);
  ctx.stroke();

  ctx.fillStyle = persen > 0.5 ? HITAM : PUTIH;
  ctx.font = `bold ${Math.round(14 * skalaFont())}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, xPil + lebarPil / 2, yPil + tinggiPil / 2 + 1);
}

// =========================
// GAMBAR GAME (arena, makanan, ular, header, kontrol, game over)
// =========================
function gambarGame(shiftPressed, speed) {
  gambarBackground();

  ctx.fillStyle = "rgb(20,8,18)";
  ctx.fillRect(0, 0, LEBAR, TINGGI_HEADER);

  ctx.fillStyle = PUTIH;
  ctx.font = `${Math.round(28 * skalaFont())}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`SCORE : ${skor}`, 15, TINGGI_HEADER / 2);

  ctx.textAlign = "right";
  ctx.fillText(`SPEED : ${speed}`, LEBAR - 15, TINGGI_HEADER / 2);

  gambarEfekBar();

  // Makanan
  for (const m of makananList) gambarMakanan(m);

  // Warna ular (mode rainbow di luar efek spesial)
  const tahapSekarang = Math.floor(skor / 5) % 4;
  if (tahapSekarang === 3 && tahapSebelumnya !== 3) {
    indexWarna = 0;
    waktuWarna = performance.now();
  }
  tahapSebelumnya = tahapSekarang;

  if (tahapSekarang === 3) {
    const now = performance.now();
    if (now - waktuWarna >= 500) {
      indexWarna = (indexWarna + 1) % warna_pelangi.length;
      waktuWarna = now;
    }
  }

  let warnaUlar;
  let bayangan = null;
  if (shiftPressed) {
    warnaUlar = PUTIH;
  } else if (efekAktif) {
    if (efekAktif.tipe === "glow") { warnaUlar = KUNING; bayangan = { warna: KUNING, blur: 22 }; }
    else if (efekAktif.tipe === "freeze") { warnaUlar = BIRU; bayangan = { warna: BIRU, blur: 16 }; }
    else { warnaUlar = UNGU; bayangan = { warna: UNGU, blur: 16 }; }
  } else {
    warnaUlar = tentukanWarna(skor);
    if (warnaUlar === "warna_warni") warnaUlar = warna_pelangi[indexWarna];
  }

  const now = performance.now();
  const efekTambah = now - waktuTambah < DURASI_EFEK;

  if (bayangan) {
    ctx.save();
    ctx.shadowColor = bayangan.warna;
    ctx.shadowBlur = bayangan.blur;
  }

  snakeBody.forEach((segmen, i) => {
    const px = segmen.x + GRID_SIZE / 2;
    const py = segmen.y + GRID_SIZE / 2;
    const radius = GRID_SIZE / 2 - 1;

    let warna;
    if (efekTambah && i === snakeBody.length - 1 && !shiftPressed) {
      warna = PUTIH;
    } else {
      warna = warnaUlar;
    }

    ctx.fillStyle = warna;
    ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill();

    if (i > 0) {
      ctx.fillStyle = "rgb(255,180,210)";
      ctx.beginPath(); ctx.arc(px - 4, py + 3, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 4, py + 3, 2, 0, Math.PI * 2); ctx.fill();
    }

    if (i === 0) {
      ctx.fillStyle = PUTIH;
      ctx.beginPath(); ctx.arc(px - 4, py - 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 4, py - 3, 3, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = HITAM;
      ctx.beginPath(); ctx.arc(px - 4, py - 3, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 4, py - 3, 1, 0, Math.PI * 2); ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py + 3, 5, 0.2, 2.9);
      ctx.strokeStyle = HITAM;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });

  if (bayangan) ctx.restore();

  if (layarAktif === "playing") {
    const kontrol = dapatkanKontrolMobile();
    gambarKontrolMobile(kontrol, shiftPressed);
  }

  if (layarAktif === "gameover") {
    ctx.fillStyle = "rgba(0,0,0,0.67)";
    ctx.fillRect(0, 0, LEBAR, TINGGI);

    ctx.fillStyle = PINK;
    ctx.font = `bold ${Math.round(52 * skalaFont())}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const yGameOver = TINGGI * 0.30;
    ctx.fillText("GAME OVER", LEBAR / 2, yGameOver);

    ctx.fillStyle = PUTIH;
    ctx.font = `${Math.round(28 * skalaFont())}px sans-serif`;
    ctx.fillText(`Score Akhir : ${skor}`, LEBAR / 2, yGameOver + 65 * skalaFont());

    const [restartRect, quitRect] = dapatkanTombolGameOver();
    gambarTombol(restartRect, "RESTART", PINK, mousePos, HITAM);
    gambarTombol(quitRect, "QUIT / EXIT", TOMBOL_ABU, mousePos, PUTIH);

    ctx.fillStyle = ABU;
    ctx.font = `${Math.round(20 * skalaFont())}px sans-serif`;
    ctx.fillText(
      "Tekan SPACE untuk mulai lagi, atau ESC untuk kembali",
      LEBAR / 2,
      Math.max(restartRect.y + restartRect.h, quitRect.y + quitRect.h) + 20
    );
  }
}

// =========================
// LOOP UTAMA
// =========================
function loop(waktuSekarang) {
  if (waktuFrameSebelumnya === null) waktuFrameSebelumnya = waktuSekarang;
  const dt = waktuSekarang - waktuFrameSebelumnya;
  waktuFrameSebelumnya = waktuSekarang;

  if (layarAktif === "loading") {
    const elapsed = Math.max(0, waktuSekarang - waktuMulaiLoading);
    gambarLoading(elapsed);
    if (elapsed >= 4000) {
      layarAktif = "start";
      resetGame();
    }
  } else if (layarAktif === "start") {
    gambarStart();
  } else if (layarAktif === "playing" || layarAktif === "gameover") {
    if (efekAktif && waktuSekarang - efekAktif.mulai >= efekAktif.durasi) {
      efekAktif = null;
    }

    const shiftPressed = shiftKeyboard || shiftTouch || shiftMouseHeld;
    const speedNormal = Math.min(18, 6 + Math.floor(skor / 2));
    let speed = Math.min(18, shiftPressed ? speedNormal + 6 : speedNormal);

    if (efekAktif && efekAktif.tipe === "freeze") {
      speed = Math.max(3, Math.floor(speed * 0.5));
    }

    if (layarAktif === "playing") {
      akumulatorWaktu += dt;
      const interval = 1000 / speed;
      while (akumulatorWaktu >= interval) {
        updateGame();
        akumulatorWaktu -= interval;
        if (layarAktif !== "playing") { akumulatorWaktu = 0; break; }
      }
    }

    gambarGame(shiftPressed, speed);
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
