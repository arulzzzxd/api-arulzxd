/**
 * NAMA SCRAPE  :: LUVYAA GENRES
 * [•] BASIS        :: v4.luvyaa.co
 */

const express = require('express');
const router = express.Router();

const GENRES = {
  '4': 'Action', '5': 'Fantasy', '6': 'Adventure', '10': 'Drama',
  '25': 'School Life', '29': 'Psychological', '33': 'Time Travel',
  '35': 'Revenge', '43': 'Magic', '50': 'Adult', '51': 'Supernatural',
  '52': 'Romance', '83': 'Ecchi', '109': 'Thriller', '111': 'Comedy',
  '133': 'Military', '298': 'Mystery', '705': 'Cooking', '818': 'Demons',
  '881': 'Game', '1002': 'Shoujo', '1049': 'Mature', '1119': 'Historical',
  '1153': 'Shounen', '1224': 'Martial Arts', '1326': 'Horror',
  '1454': 'Gender Bender', '1455': 'Isekai', '1842': 'Manhwa',
  '1843': 'Adaptation', '1844': 'Manhua', '1845': 'Webtoon',
  '1846': 'Full Color', '1847': 'Webtoons', '1866': 'Sci-fi',
  '1894': 'Sports', '1900': 'Yuri', '1984': 'Seinen', '2055': 'Demon',
  '2056': 'Harem', '2089': 'Reincarnation', '2097': 'Comedy',
  '2099': 'Super Power', '2119': 'Josei', '2135': 'Tragedy',
  '2154': 'Seinen(M)', '2183': 'Shoujo(G)', '2188': 'Crime',
  '2251': 'Gore', '2806': 'Villainess', '4866': 'Smut', '4901': 'Shoujo(G)',
  '4914': 'Shounen Ai', '4951': 'Reverse Harem', '4999': 'Rofan',
  '5089': 'Entertainment', '5408': 'College Life', '5410': 'Office Workers'
};

router.get('/', (req, res) => {
  return res.json({
    success: true,
    author: 'arulzxd',
    data: { total: Object.keys(GENRES).length, genres: GENRES }
  });
});

router.status = "ready";
router.type = "free";
module.exports = router;
