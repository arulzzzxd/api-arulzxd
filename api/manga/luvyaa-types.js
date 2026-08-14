/**
 * NAMA SCRAPE  :: LUVYAA TYPES & METADATA
 * [•] BASIS        :: v4.luvyaa.co
 */

const express = require('express');
const router = express.Router();

const TYPES = ['manga', 'manhua', 'manhwa', 'novel', 'pornwa'];
const STATUSES = ['', 'ongoing', 'completed', 'hiatus'];
const ORDERS = ['update', 'popular', 'title', 'titlereverse'];

router.get('/', (req, res) => {
  return res.json({
    success: true,
    author: 'arulzxd',
    data: { types: TYPES, statuses: STATUSES, orders: ORDERS, totalGenres: 57 }
  });
});

router.status = "ready";
router.type = "free";
module.exports = router;
