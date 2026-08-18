const express = require('express');
const { KINDS } = require('../../src/accounting');
const { TYPES, DIRECTIONS, TYPE_LABELS, PURPOSES, CATEGORIES } = require('../constants');

function createCatalogRouter() {
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json({
      types: TYPES.map((value) => ({
        value,
        label: TYPE_LABELS[value],
        purposes: PURPOSES.filter((purpose) => purpose.tipe === value).map((purpose) => ({
          ...purpose,
          categories: CATEGORIES[purpose.value],
        })),
      })),
      directions: DIRECTIONS.map((value) => ({ value, label: value === 'masuk' ? 'Pemasukan' : 'Pengeluaran' })),
      kinds: KINDS,
      constraints: {
        maxNominal: 999999999999,
        maxPurposeLength: 80,
        maxCategoryLength: 120,
        maxDescriptionLength: 200,
        transferRequiredFields: ['akunSumber', 'akunTujuan'],
      },
    });
  });
  return router;
}

module.exports = { createCatalogRouter };
