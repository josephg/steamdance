const React = require('react')
const ReactDOM = require('react-dom')

const Browse = React.createClass({
  render() {
    const worlds = [];
    for (var worldId in this.props.worlds) {
      const world = this.props.worlds[worldId];
      worlds.push(
        <div key={worldId}>
          <a href={`/${worldId}`}>
            <span>{worldId}</span>
            {(world.data == null) ?
              <span>EMPTY</span>
            :
              <img width='200' height='200' src={world.data.img} />
            }
          </a>
        </div>
      );
    }

    return <div>
      <button onClick={this.newWorld}>New world</button>
      {worlds}
    </div>;
  },

  newWorld() {
    fetch("/world", {method: 'POST', credentials: 'same-origin'}).then(res => res.json()).then(world =>
      location.href = `/${world.id}`
    ).catch(e => console.error(e));
  }
})

fetch("/worlds").then(res => res.json()).then(worlds => {
  ReactDOM.render(React.createElement(Browse, {worlds}), document.getElementById('root'))
})
