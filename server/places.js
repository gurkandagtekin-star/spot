const REMOVED_PLACE_IDS = [
  'plc_boston',
  'plc_moksha',
  'plc_lab',
  'plc_sahil',
];

function seedPlaces(db) {
  db.places = Array.isArray(db.places) ? db.places : [];
  db.places = db.places.filter((p) => !REMOVED_PLACE_IDS.includes(p.id));
  return db.places;
}

module.exports = { seedPlaces };
