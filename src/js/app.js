// setup root logger first, as it's used by other modules
var React = require('react');
var Router = require('react-router');
var $ = require('jquery');

var { Route, DefaultRoute, RouteHandler } = Router;

var Logger = require('./utils/logger');
import Store from './data/store';
import { Provider } from 'react-redux';


var Layout = require('./ui/layout');
var EntriesView = require('./ui/pages/entries');
var NewEntry = require('./ui/pages/newEntry');
var SettingsView = require('./ui/pages/settings/index');


var App = React.createClass({
  getInitialState: function() {
    return {
      logger: Logger,
    };
  },

  render: function() {
    return (
      <Provider store={Store}>
        {() => 
          <Layout {...this.props} {...this.state}>
            <RouteHandler {...this.props}  {...this.state}/>
          </Layout>
        }
      </Provider>
    );
  },
});



var routes = (
  <Route handler={App}>
    <DefaultRoute handler={EntriesView} />
    <Route name="entries" path="/entries/:entryId?" handler={EntriesView} />
    <Route name="newEntry" path="/newEntry" handler={NewEntry} />
    <Route name="settings" path="/settings" handler={SettingsView} />
  </Route>
);


Router.run(routes, Router.HashLocation, function(Handler, state) {
  React.render(
    <Handler routes={state.routes} params={state.params} query={state.query} />, 
    $('main').get(0)
  );
});
 

