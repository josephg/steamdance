const yo = require('yo-yo');
const SimpleGrid = require('./simplegrid');

const currentUser = window.currentUser;

const Navbar = () => yo`
  <div className="navbar">
    <div className="title">
      steam.dance
    </div>
    <div className="right">
      <a className="button" href="/new">+ New world</a>
      ${currentUser
        ? yo`<a href="/logout">Log out ${currentUser}</a>`
        : yo`<a href="/login">Log in</a>`}
      ${!currentUser ? yo`<a href="/signup">Sign up</a>` : null}
    </div>
  </div>`;

const Worlds = (worlds) => yo`
  <div className="worlds">
    ${Object.keys(worlds)
    .sort((a, b) => worlds[b].modifiedAt - worlds[a].modifiedAt)
    // .filter(key => key === 'josephg/test3')
    .map(id => {
      const isMine = id.split('/')[0] === currentUser;
      const classes = isMine ? 'world mine': 'world';
      return yo`
        <div className=${classes} key=${id}>
          <a href=/${id}>
            <div className="image">
              ${SimpleGrid({data: worlds[id].data, width: 300, height: 200})}
            </div>
          </a>
          <div className="details">
            <a href=/${id}>${id}</a>
          </div>
        </div>
      `;
    })}
    <div className="world dummy"></div>
    <div className="world dummy"></div>
  </div>`; // to keep the grid left-aligned, add some dummy elements

const Browse = (worlds) => yo`
  <div>
    ${Navbar()}
    <div className="main">
      ${Worlds(worlds)}
    </div>
  </div>`;

// http://caniuse.com/#search=fetch
// Waiting for edge 14 and safari 10.
require('isomorphic-fetch');
fetch("/worlds").then(res => res.json()).then(worlds => {
  yo.update(document.getElementById('root'), Browse(worlds));
});
