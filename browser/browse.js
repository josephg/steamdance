const React = require('react')
const ReactDOM = require('react-dom')

require('./browse.css')

const Navbar = React.createClass({
  render() {
    return <div className="navbar">
      <div className="title">
        steam.dance
      </div>
      <div className="right">
        <a className="button" href="/new">+ New world</a>
        {window.currentUser
          ? <a href="/logout">Log out</a>
          : <a href="/login">Log in</a>}
        {!window.currentUser ? <a href="/signup">Sign up</a> : null}
      </div>
    </div>
  },

  newWorld() {
    location.href = `/new`;
  }
})

const Worlds = React.createClass({
  render() {
    const worlds = [];
    for (var worldId in this.props.worlds) {
      const world = this.props.worlds[worldId];
      worlds.push(
        <div className="world" key={worldId}>
          <a href={`/${worldId}`}>
            <div className="image">
            {(world.data == null) ?
              <div style={{width: 200, height: 200}}></div>
            :
              <img width='300' height='200' src={world.data.img} />
            }
            </div>
          </a>
          <div className="details">
            <a href={`/${worldId}`}>{worldId}</a>
          </div>
        </div>
      );
    }
    return <div className="worlds">
      {worlds}
      {/* to keep the grid left-aligned, add some dummy elements */}
      <div className="world dummy"></div>
      <div className="world dummy"></div>
    </div>
  }
})

const Browse = React.createClass({
  render() {
    return <div>
      <Navbar/>
      <div className="main">
        <Worlds worlds={this.props.worlds} />
      </div>
    </div>;
  }
})

fetch("/worlds").then(res => res.json()).then(worlds => {
  ReactDOM.render(React.createElement(Browse, {worlds}), document.getElementById('root'))
})
