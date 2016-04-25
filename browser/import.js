import React from 'react';
import ReactDOM from 'react-dom';

const db = require('./db');

const SimpleGrid = require('./simplegrid');

const WorldList = ({worlds, remove}) => {
  // console.log(worlds);
  const rem = name => e => {
    remove(name);
  };
  const contents = worlds.map(({name, data}) => (
    <div key={name}>{name}
      <button onClick={rem(name)}>X</button>
      <SimpleGrid width={300} height={300} data={data} />
    </div>
  ));
  return <div>{contents}</div>;
};

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {worlds:[]};
  }

  loadFromFile(e) {
    console.log(this, e);
    if (e.target.files.length < 1) return;
    const f = e.target.files[0];
    if (f.type !== 'application/json') return;

    const reader = new FileReader();
    reader.onloadend = e => {
      const data = JSON.parse(reader.result);

      Promise.all(Object.keys(data).map(k => {
        var parts = k.split(' ');
        if (parts[0] != 'worldv2') {
          console.warn(`skipping localstorage item '${k}'`, parts);
          return;
        }
        var name = parts[1];
        var grid = data[k];

        // We're going to roundtrip the encoding to get it up to date with the
        // current encoding system.
        return db.fromData(grid).then(encoded => ({name, data: encoded}))
      }).filter(x => !!x)).then(d => {
        this.setState({worlds:d});
      });
    };
    reader.readAsText(f);

  }

  remove(name) {
    this.setState({worlds: this.state.worlds.filter(w => w.name !== name)});
  }

  doImport() {
    this.state.worlds.forEach(({name, data}) => {
      const grid = db.toData(data)
      console.log('uploading world', name);
      fetch(`${location.origin}/josephg/${name}.json`, {
        method: 'PUT',
        headers: {'content-type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify({data: grid}),
      }).then(res => console.log(name, res.status));
    });
  }

  render() {
    return (<div>
      <input type='file' onChange={this.loadFromFile.bind(this)} />
      <button onClick={this.doImport.bind(this)}>Import</button>
      <WorldList worlds={this.state.worlds} remove={this.remove.bind(this)} />

    </div>);
  }
}

ReactDOM.render(<App />, document.getElementById('app'));
