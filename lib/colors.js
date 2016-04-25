// The boilerplate CSS colors.

const COLORS = {
  bridge: 'rgb(26, 126, 213)',
  // bridge: 'hsl(216, 92%, 33%)'
  // thinbridge: 'hsl(203, 67%, 51%)'
  negative: 'hsl(16, 68%, 50%)',
  nothing: 'hsl(0, 0%, 100%)',
  positive: 'hsl(120, 52%, 58%)',
  shuttle: 'hsl(283, 65%, 45%)',
  solid: 'hsl(184, 49%, 7%)',
  thinshuttle: 'hsl(283, 89%, 75%)',
  thinsolid: 'hsl(0, 0%, 71%)',
  //interface: 'hsl(44, 87%, 52%)',
  ribbon: 'rgb(185, 60, 174)',
  ribbonbridge: 'rgb(108, 30, 217)'
};

// These colors are pretty ugly but they'll do for now. Maybe just 1 color but
// with numbers drawn on the cell?
(() => {
  for (var i = 1; i <= 8; i++) {
    COLORS[`ins${i}`] = `hsl(188, ${24 + 6 * i}%, ${43 - 2*i}%)`;
    COLORS[`ins${i+8}`] = `hsl(44, #{24 + 6 * i}%, #{43 - 2*i}%)`;
  }
})();

module.exports = COLORS;
