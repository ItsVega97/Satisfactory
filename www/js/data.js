/* =========================================================
   Factoría 2D — Datos del juego (objetos, recetas, edificios, hitos)
   Inspirado en Satisfactory (Coffee Stain Studios)
   ========================================================= */

const TILE = 32;
const MAP_W = 64;
const MAP_H = 48;

const BELT_SPEED = 2.0;     // tiles / segundo
const BELT_SPACING = 0.45;  // separación mínima entre objetos en cinta
const OUT_CAP = 50;         // capacidad de búfer de salida de las máquinas

/* ---------------- Objetos ---------------- */
const ITEMS = {
  iron_ore:         { name: 'Mineral de hierro',  color: '#9aa3b5', ring: '#6e7787' },
  copper_ore:       { name: 'Mineral de cobre',   color: '#d97f4a', ring: '#a35a30' },
  limestone:        { name: 'Caliza',             color: '#d8cfae', ring: '#a89f7f' },
  coal:             { name: 'Carbón',             color: '#3c4148', ring: '#22262b' },
  biomass:          { name: 'Biomasa',            color: '#87ab3c', ring: '#5d7a24' },
  iron_ingot:       { name: 'Lingote de hierro',  color: '#cfd6e0', ring: '#98a1af' },
  copper_ingot:     { name: 'Lingote de cobre',   color: '#e6935c', ring: '#b06a3c' },
  plate:            { name: 'Placa de hierro',    color: '#b8c2cf', ring: '#7f8b9b' },
  rod:              { name: 'Varilla de hierro',  color: '#8f99a7', ring: '#616b79' },
  screw:            { name: 'Tornillo',           color: '#aeb8c4', ring: '#77828f' },
  wire:             { name: 'Alambre',            color: '#e8a34f', ring: '#b3782f' },
  cable:            { name: 'Cable',              color: '#54575e', ring: '#33363c' },
  concrete:         { name: 'Hormigón',           color: '#c2bba9', ring: '#8f8977' },
  reinforced_plate: { name: 'Placa reforzada',    color: '#7e93ad', ring: '#54687f' },
  rotor:            { name: 'Rotor',              color: '#cd8a52', ring: '#96602f' },
};

/* ---------------- Recetas ----------------
   time en segundos por ciclo. hand = fabricable en el banco del HUB. */
const RECIPES = {
  iron_ingot:       { name: 'Lingote de hierro', in: { iron_ore: 1 },              out: { iron_ingot: 1 },       time: 2,  mach: 'smelter',     hand: true },
  copper_ingot:     { name: 'Lingote de cobre',  in: { copper_ore: 1 },            out: { copper_ingot: 1 },     time: 2,  mach: 'smelter',     hand: true },
  plate:            { name: 'Placa de hierro',   in: { iron_ingot: 2 },            out: { plate: 1 },            time: 4,  mach: 'constructor', hand: true },
  rod:              { name: 'Varilla de hierro', in: { iron_ingot: 1 },            out: { rod: 1 },              time: 3,  mach: 'constructor', hand: true },
  screw:            { name: 'Tornillo',          in: { rod: 1 },                   out: { screw: 4 },            time: 4,  mach: 'constructor', hand: true },
  wire:             { name: 'Alambre',           in: { copper_ingot: 1 },          out: { wire: 2 },             time: 3,  mach: 'constructor', hand: true },
  cable:            { name: 'Cable',             in: { wire: 2 },                  out: { cable: 1 },            time: 3,  mach: 'constructor', hand: true },
  concrete:         { name: 'Hormigón',          in: { limestone: 3 },             out: { concrete: 1 },         time: 4,  mach: 'constructor', hand: true },
  reinforced_plate: { name: 'Placa reforzada',   in: { plate: 4, screw: 8 },       out: { reinforced_plate: 1 }, time: 8,  mach: 'assembler',   hand: true },
  rotor:            { name: 'Rotor',             in: { rod: 3, screw: 10 },        out: { rotor: 1 },            time: 10, mach: 'assembler',   hand: true },
};

/* ---------------- Edificios ----------------
   power: MW (negativo consume, positivo genera). rate en objetos/seg (mineros). */
const BUILDINGS = {
  hub: {
    name: 'HUB', w: 4, h: 3, cost: {}, power: 0, emoji: '🏠',
    color: '#c9a86a', roof: '#e0c084', desc: 'Centro de mando. Entrega objetos para completar hitos y fabrica a mano en su banco.',
    buildable: false,
  },
  portable_miner: {
    name: 'Taladro portátil', w: 1, h: 1, cost: {}, power: 0, emoji: '⛏️',
    color: '#8c8f5a', roof: '#a9ac74', limit: 6, rate: 0.25, cap: 40,
    desc: 'Colócalo sobre un yacimiento. Extrae lentamente; toca para recoger. Máx. 6.',
    buildable: true,
  },
  miner1: {
    name: 'Minero Mk.1', w: 2, h: 2, cost: { plate: 10, rod: 5 }, power: -5, emoji: '🛠️',
    color: '#8a7a5a', roof: '#a4936d', rate: 1.0,
    desc: 'Extrae 60/min de un yacimiento. Saca por cintas. Requiere 5 MW.',
    buildable: true,
  },
  smelter: {
    name: 'Fundidora', w: 2, h: 2, cost: { rod: 5, wire: 8 }, power: -4, emoji: '🔥',
    color: '#b06a3c', roof: '#cd8451', desc: 'Funde mineral en lingotes. Requiere 4 MW.',
    buildable: true,
  },
  constructor: {
    name: 'Constructor', w: 2, h: 2, cost: { plate: 8, wire: 8 }, power: -4, emoji: '🏭',
    color: '#4f7290', roof: '#6289a9', desc: 'Fabrica piezas básicas a partir de un ingrediente. Requiere 4 MW.',
    buildable: true,
  },
  assembler: {
    name: 'Ensambladora', w: 3, h: 3, cost: { plate: 12, cable: 8, concrete: 10 }, power: -15, emoji: '⚙️',
    color: '#7a5f96', roof: '#9377b3', desc: 'Combina dos ingredientes en piezas avanzadas. Requiere 15 MW.',
    buildable: true,
  },
  conveyor: {
    name: 'Cinta transportadora', w: 1, h: 1, cost: { plate: 1 }, power: 0, emoji: '➡️',
    color: '#555a63', roof: '#555a63', desc: 'Transporta objetos entre edificios. 1 placa por tramo.',
    buildable: true, isBelt: true,
  },
  storage: {
    name: 'Contenedor', w: 2, h: 2, cost: { plate: 10, rod: 5 }, power: 0, emoji: '📦',
    color: '#9aa3ad', roof: '#b5bec8', cap: 400,
    desc: 'Almacena hasta 400 objetos. Acepta y expulsa por cintas.',
    buildable: true,
  },
  biomass_burner: {
    name: 'Quemador de biomasa', w: 2, h: 2, cost: { plate: 8, rod: 4 }, power: 20, emoji: '🌿',
    color: '#6f8a4a', roof: '#88a55f', burnTime: 12, fuelItem: 'biomass',
    desc: 'Genera 20 MW quemando biomasa. Se carga a mano (toca el edificio).',
    buildable: true,
  },
  coal_generator: {
    name: 'Generador de carbón', w: 3, h: 2, cost: { plate: 20, concrete: 10, cable: 10 }, power: 75, emoji: '⚡',
    color: '#4a505a', roof: '#5f6672', burnTime: 4, fuelItem: 'coal',
    desc: 'Genera 75 MW quemando carbón. Acepta carbón por cinta.',
    buildable: true,
  },
};

/* Recetas disponibles por máquina */
const MACH_RECIPES = {
  smelter: ['iron_ingot', 'copper_ingot'],
  constructor: ['plate', 'rod', 'screw', 'wire', 'cable', 'concrete'],
  assembler: ['reinforced_plate', 'rotor'],
};

/* ---------------- Hitos (Hitos del HUB) ---------------- */
const MILESTONES = [
  {
    name: 'Puesta en marcha del HUB',
    desc: 'Recolecta mineral de hierro picando a mano o con taladros portátiles.',
    req: { iron_ore: 30 },
    unlocks: { buildings: ['smelter'], recipes: ['iron_ingot', 'copper_ingot', 'rod', 'wire'] },
  },
  {
    name: 'Logística',
    desc: 'Funde lingotes de hierro para desbloquear la logística básica.',
    req: { iron_ingot: 20 },
    unlocks: { buildings: ['constructor', 'conveyor', 'storage'], recipes: ['plate', 'screw'] },
  },
  {
    name: 'Automatización',
    desc: 'Produce placas y varillas. Desbloquea mineros automáticos y energía.',
    req: { plate: 30, rod: 30 },
    unlocks: { buildings: ['miner1', 'biomass_burner'], recipes: ['cable', 'concrete'] },
  },
  {
    name: 'Electrónica',
    desc: 'Domina el cobre y el hormigón para la industria avanzada.',
    req: { wire: 60, cable: 20, concrete: 20 },
    unlocks: { buildings: ['assembler', 'coal_generator'], recipes: ['reinforced_plate'] },
  },
  {
    name: 'Ingeniería pesada',
    desc: 'Fabrica placas reforzadas en serie.',
    req: { reinforced_plate: 15, concrete: 30 },
    unlocks: { recipes: ['rotor'] },
  },
  {
    name: 'Ascensor Espacial: Fase 1',
    desc: 'Entrega las piezas finales del proyecto. ¡La misión de FICSIT te espera!',
    req: { rotor: 10, reinforced_plate: 10, cable: 50 },
    unlocks: { victory: true },
  },
];

/* Tipos de yacimiento */
const NODE_TYPES = {
  iron:      { item: 'iron_ore',   color: '#aeb7c9', name: 'Yacimiento de hierro' },
  copper:    { item: 'copper_ore', color: '#e08a52', name: 'Yacimiento de cobre' },
  limestone: { item: 'limestone',  color: '#e0d7b4', name: 'Yacimiento de caliza' },
  coal:      { item: 'coal',       color: '#43484f', name: 'Yacimiento de carbón' },
};

function itemName(id) { return ITEMS[id] ? ITEMS[id].name : id; }
function fmtCost(cost) {
  const parts = [];
  for (const k in cost) parts.push(cost[k] + ' ' + itemName(k));
  return parts.length ? parts.join(', ') : 'Gratis';
}
