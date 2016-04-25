const React = require('react')
const ReactDOM = require('react-dom')

const db = require('./db');
const SimpleGrid = require('./simplegrid');

require('./browse.css')

const currentUser = window.currentUser;

const Navbar = React.createClass({
  render() {
    return <div className="navbar">
      <div className="title">
        steam.dance
      </div>
      <div className="right">
        <a className="button" href="/new">+ New world</a>
        {currentUser
          ? <a href="/logout">Log out {currentUser}</a>
          : <a href="/login">Log in</a>}
        {!currentUser ? <a href="/signup">Sign up</a> : null}
      </div>
    </div>
  },

  newWorld() {
    location.href = `/new`;
  }
})

const World = React.createClass({
  componentDidMount() {
    db.fromData(this.props.data).then(grid => this.setState({grid}));
  },
  render() {
    const {width, height} = this.props;
    if (!this.state) return <div style={{width, height}}></div>;
    return <SimpleGrid width={width} height={height} data={this.state.grid} />
  }
});

const Worlds = React.createClass({
  render() {
    const worlds = [];
    for (var worldId in this.props.worlds) {
      const world = this.props.worlds[worldId];

      const isMine = worldId.split('/')[0] === currentUser;
      const classes = isMine ? 'world mine': 'world';
      worlds.push(
        <div className={classes} key={worldId}>
          <a href={`/${worldId}`}>
            <div className="image">
              <World data={world.data} width={200} height={200} />
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
