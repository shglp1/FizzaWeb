/**
 * Vehicle catalog and display smoke tests.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isValidCatalogMakeModel,
  MIN_VEHICLE_YEAR,
  resolveLegacyVehicleFields,
  SAUDI_VEHICLE_CATALOG,
} from '../lib/vehicles/vehicleCatalog.ts';
import {
  normalizeVehicleForDisplay,
  parseLegacyVehicleModel,
  formatVehicleDisplayLine,
} from '../lib/vehicles/vehicleDisplay.ts';
import { saudiPlateError } from '../lib/validations/saudiPlate.ts';

test('valid catalog make/model passes', () => {
  assert.equal(isValidCatalogMakeModel('Toyota', 'Camry'), true);
  assert.equal(isValidCatalogMakeModel('Hyundai', 'Sonata'), true);
});

test('invalid make/model combination fails', () => {
  assert.equal(isValidCatalogMakeModel('Toyota', 'Sonata'), false);
  assert.equal(isValidCatalogMakeModel('Unknown', 'Camry'), false);
});

test('year 2019 fails driver application minimum', () => {
  assert.ok(2019 < MIN_VEHICLE_YEAR);
  assert.equal(MIN_VEHICLE_YEAR, 2020);
});

test('valid Saudi plate passes', () => {
  assert.equal(saudiPlateError('1234 ABC 12'), null);
  assert.equal(saudiPlateError('5678 XYZ 34'), null);
});

test('invalid Saudi plate fails', () => {
  assert.ok(saudiPlateError(''));
  assert.ok(saudiPlateError('!@#'));
});

test('parse legacy combined model string', () => {
  assert.deepEqual(parseLegacyVehicleModel('Toyota Camry'), { make: 'Toyota', model: 'Camry' });
});

test('resolveLegacyVehicleFields normalizes catalog values', () => {
  const r = resolveLegacyVehicleFields('Toyota', 'Camry');
  assert.equal(r.vehicleBrand, 'Toyota');
  assert.equal(r.vehicleModel, 'Camry');
  assert.equal(r.isLegacy, false);
});

test('legacy approved driver display does not crash', () => {
  const line = formatVehicleDisplayLine({ model: 'Custom Van 2020', color: 'White', plateNumber: '1234 ABC 12' });
  assert.ok(line.includes('Custom Van 2020'));
  const n = normalizeVehicleForDisplay({ model: 'Custom Van 2020', plateNumber: '1234 ABC 12', color: 'White' });
  assert.ok(n.displayLabel);
});

test('catalog has Saudi market makes', () => {
  const makes = SAUDI_VEHICLE_CATALOG.map((e) => e.make);
  assert.ok(makes.includes('Toyota'));
  assert.ok(makes.includes('Hyundai'));
  assert.ok(makes.length >= 10);
});
