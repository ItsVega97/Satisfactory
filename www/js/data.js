/* =========================================================
   Factoría 2D — Datos del juego (objetos, recetas, edificios, hitos)
   Inspirado en Satisfactory (Coffee Stain Studios)
   ========================================================= */

const TILE = 32;
const MAP_W = 80;
const MAP_H = 60;

const BELT_SPEED = 2.0;     // tiles / segundo
const BELT_SPACING = 0.45;  // separación mínima entre objetos en cinta
const OUT_CAP = 50;         // capacidad de búfer de salida de las máquinas

/* Red eléctrica: distancias máximas de conexión (huecos entre edificios, en tiles) */
const PLUG_RANGE = 3.5;   // máquina ↔ poste / generador / HUB
const LINK_RANGE = 6;     // poste ↔ poste / generador / HUB

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
  steel_ingot:      { name: 'Lingote de acero',   color: '#79828f', ring: '#525a65' },
  steel_beam:       { name: 'Viga de acero',      color: '#5b6673', ring: '#3d454f' },
  steel_pipe:       { name: 'Tubo de acero',      color: '#939dab', ring: '#646d7a' },
  stator:           { name: 'Estátor',            color: '#7592ad', ring: '#4e6880' },
  motor:            { name: 'Motor',              color: '#d8a13f', ring: '#a3742a' },
  modular_frame:    { name: 'Bastidor modular',   color: '#9aa5b1', ring: '#6b7580' },
  encased_beam:     { name: 'Viga revestida',     color: '#a8a08b', ring: '#7a7362' },
  heavy_frame:      { name: 'Bastidor pesado',    color: '#6e7885', ring: '#4b525c' },
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
  steel_ingot:      { name: 'Lingote de acero',  in: { iron_ore: 2, coal: 2 },     out: { steel_ingot: 2 },      time: 4,  mach: 'foundry',     hand: true },
  steel_beam:       { name: 'Viga de acero',     in: { steel_ingot: 3 },           out: { steel_beam: 1 },       time: 4,  mach: 'constructor', hand: true },
  steel_pipe:       { name: 'Tubo de acero',     in: { steel_ingot: 2 },           out: { steel_pipe: 1 },       time: 3,  mach: 'constructor', hand: true },
  stator:           { name: 'Estátor',           in: { steel_pipe: 2, wire: 6 },   out: { stator: 1 },           time: 8,  mach: 'assembler',   hand: true },
  motor:            { name: 'Motor',             in: { rotor: 1, stator: 1 },      out: { motor: 1 },            time: 8,  mach: 'assembler',   hand: true },
  modular_frame:    { name: 'Bastidor modular',  in: { reinforced_plate: 2, rod: 6 }, out: { modular_frame: 1 }, time: 10, mach: 'assembler',   hand: true },
  encased_beam:     { name: 'Viga revestida',    in: { steel_beam: 3, concrete: 5 }, out: { encased_beam: 1 },   time: 8,  mach: 'assembler',   hand: true },
  heavy_frame:      { name: 'Bastidor pesado',   in: { modular_frame: 2, encased_beam: 3, screw: 20 }, out: { heavy_frame: 1 }, time: 15, mach: 'assembler', hand: true },
};

/* ---------------- Edificios ----------------
   power: MW (negativo consume, positivo genera). rate en objetos/seg (mineros). */
const BUILDINGS = {
  hub: {
    name: 'HUB', w: 4, h: 3, cost: { plate: 8, rod: 6, cable: 4 }, power: 10,
    color: '#c9a86a', roof: '#e0c084',
    desc: 'Tu base de operaciones: constrúyelo con las piezas de la nave. Te entrega el pico, acepta entregas de misiones, fabrica a mano y suministra 10 MW por un único cable.',
    buildable: true,
  },
  portable_miner: {
    name: 'Taladro portátil', w: 1, h: 1, cost: { iron_ore: 5 }, power: 0,
    color: '#8c8f5a', roof: '#a9ac74', limit: 6, rate: 0.25, cap: 40,
    desc: 'Colócalo sobre un yacimiento. Extrae lentamente sin electricidad; toca para recoger. Máx. 6.',
    buildable: true,
  },
  miner1: {
    name: 'Minero Mk.1', w: 2, h: 2, cost: { plate: 10, rod: 5 }, power: -5,
    color: '#8a7a5a', roof: '#a4936d', rate: 1.0,
    desc: 'Extrae 60/min de un yacimiento y lo saca por cintas. Requiere 5 MW y conexión a la red eléctrica.',
    buildable: true,
  },
  miner2: {
    name: 'Minero Mk.2', w: 2, h: 2, cost: { steel_beam: 8, steel_pipe: 4, plate: 10 }, power: -12,
    color: '#5f7185', roof: '#75899f', rate: 2.0,
    desc: 'Extrae 120/min de un yacimiento. Requiere 12 MW y conexión a la red eléctrica.',
    buildable: true,
  },
  smelter: {
    name: 'Fundidora', w: 2, h: 2, cost: { rod: 5, wire: 8 }, power: -4,
    color: '#b06a3c', roof: '#cd8451',
    desc: 'Funde mineral en lingotes. Requiere 4 MW y conexión a la red eléctrica.',
    buildable: true,
  },
  constructor: {
    name: 'Constructor', w: 2, h: 2, cost: { plate: 8, wire: 8 }, power: -4,
    color: '#4f7290', roof: '#6289a9',
    desc: 'Fabrica piezas básicas a partir de un ingrediente. Requiere 4 MW y conexión a la red eléctrica.',
    buildable: true,
  },
  assembler: {
    name: 'Ensambladora', w: 3, h: 3, cost: { plate: 12, cable: 8, concrete: 10 }, power: -15,
    color: '#7a5f96', roof: '#9377b3',
    desc: 'Combina dos ingredientes en piezas avanzadas. Requiere 15 MW y conexión a la red eléctrica.',
    buildable: true,
  },
  conveyor: {
    name: 'Cinta transportadora', w: 1, h: 1, cost: { plate: 1 }, power: 0,
    color: '#555a63', roof: '#555a63', desc: 'Transporta objetos entre edificios. Cuesta 1 placa de hierro por tramo.',
    buildable: true, isBelt: true,
  },
  splitter: {
    name: 'Separador', w: 1, h: 1, cost: { plate: 6, wire: 4 }, power: 0,
    color: '#6b7280', roof: '#828a99',
    desc: 'Reparte lo que entra por una cinta entre hasta 3 cintas de salida, por turnos. No necesita electricidad.',
    buildable: true,
  },
  foundry: {
    name: 'Fundición de acero', w: 3, h: 2, cost: { plate: 15, rod: 10, concrete: 10 }, power: -16,
    color: '#7a4b33', roof: '#935c40',
    desc: 'Funde mineral de hierro y carbón en lingotes de acero. Requiere 16 MW y conexión a la red eléctrica.',
    buildable: true,
  },
  storage: {
    name: 'Contenedor', w: 2, h: 2, cost: { plate: 10, rod: 5 }, power: 0,
    color: '#9aa3ad', roof: '#b5bec8', cap: 400,
    desc: 'Almacena hasta 400 objetos. Acepta y expulsa por cintas. No necesita electricidad.',
    buildable: true,
  },
  power_pole: {
    name: 'Poste eléctrico', w: 1, h: 1, cost: { rod: 1, wire: 3 }, power: 0, pole: true,
    color: '#6f522f', roof: '#6f522f',
    desc: 'Admite hasta 3 conexiones que trazas tú mismo (1 Cable cada una, alcance ' + LINK_RANGE + ' casillas): selecciónalo y pulsa Trazar cable hacia generadores, máquinas, el HUB u otros postes.',
    buildable: true,
  },
  biomass_burner: {
    name: 'Quemador de biomasa', w: 2, h: 2, cost: { plate: 8, rod: 4 }, power: 20,
    color: '#6f8a4a', roof: '#88a55f', burnTime: 12, fuelItem: 'biomass',
    desc: 'Genera 20 MW quemando biomasa. Se carga a mano (toca el edificio). Conéctalo con postes.',
    buildable: true,
  },
  coal_generator: {
    name: 'Generador de carbón', w: 3, h: 2, cost: { plate: 20, concrete: 10, cable: 10 }, power: 75,
    color: '#4a505a', roof: '#5f6672', burnTime: 4, fuelItem: 'coal',
    desc: 'Genera 75 MW quemando carbón. Acepta carbón por cinta. Conéctalo con postes.',
    buildable: true,
  },
};

/* Recetas disponibles por máquina */
const MACH_RECIPES = {
  smelter: ['iron_ingot', 'copper_ingot'],
  foundry: ['steel_ingot'],
  constructor: ['plate', 'rod', 'screw', 'wire', 'cable', 'concrete', 'steel_beam', 'steel_pipe'],
  assembler: ['reinforced_plate', 'rotor', 'stator', 'motor', 'modular_frame', 'encased_beam', 'heavy_frame'],
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
    unlocks: { buildings: ['constructor', 'conveyor', 'splitter', 'storage', 'power_pole'], recipes: ['plate', 'screw'] },
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
    desc: 'Primera entrega del proyecto FICSIT. Desbloquea la era del acero.',
    req: { rotor: 10, reinforced_plate: 10, cable: 50 },
    unlocks: { buildings: ['foundry'], recipes: ['steel_ingot', 'steel_beam', 'steel_pipe'] },
  },
  {
    name: 'Acero',
    desc: 'Lleva carbón por cinta hasta las fundiciones y produce acero en serie.',
    req: { steel_beam: 30, steel_pipe: 30 },
    unlocks: { buildings: ['miner2'], recipes: ['stator', 'motor'] },
  },
  {
    name: 'Motores',
    desc: 'Combina rotores y estátores para fabricar motores industriales.',
    req: { stator: 20, motor: 10 },
    unlocks: { recipes: ['modular_frame', 'encased_beam'] },
  },
  {
    name: 'Estructuras industriales',
    desc: 'Bastidores modulares y vigas revestidas para la fase final.',
    req: { modular_frame: 15, encased_beam: 20 },
    unlocks: { recipes: ['heavy_frame'] },
  },
  {
    name: 'Ascensor Espacial: Fase 2',
    desc: 'La gran entrega final. ¡Termina el proyecto del Ascensor Espacial!',
    req: { heavy_frame: 5, motor: 20, cable: 100 },
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
