var React = require('react');

var _ = require('lodash'),
  moment = require('moment');


var FormatUtils = require('../../utils/format'),
  DateString = require('./date');



module.exports = React.createClass({
  propTypes: {
    entries : React.PropTypes.array,
    selected: React.PropTypes.string,
    truncLength: React.PropTypes.number,
  },

  getDefaultProps: function() {
    return {
      entries : [],
      selected: null,
      truncLength: 300,
    };
  },

  render: function() {
    var self = this;

    var listItems = [],
      lastMonthYear = moment(0);

    var entries = this._getSortedEntries();

    _.forEach(entries, function(entry) {
      var date = moment(entry.ts);

      // if month different to current month then set as current month and display it
      if (date.month() !== lastMonthYear.month() || date.year() !== lastMonthYear.year()) {
        var monthFormat = 'MMMM';

        // if year is different then add as suffix
        if (date.year() !== lastMonthYear.year()) {
          monthFormat += ' ' + 'YYYY';
        }

        listItems.push(
          <li className="month" key={date.valueOf()}>
            <DateString format={monthFormat} date={date} /> 
          </li>
        );

        lastMonthYear = date;
      }

      var entryText = FormatUtils.htmlToStr(entry.body),
        pruned = _.trunc(entryText, self.props.truncLength);

      var selectedClass = (self.props.selected === entry.id ? 'selected': '');

      listItems.push(
        <li key={entry.id} 
          data-id={entry.id} 
          className={"entry " + selectedClass}
          onClick={self._onSelect}>
            <DateString format="D" date={date} /> 
            <span className="text">{pruned}</span>
        </li>
      )
    });

    // if empty
    if (!listItems.length) {
      listItems.push(
        <li key="noentry"
          className={"entry none"}>
            No entries yet
        </li>
      )
    }

    return (
      <ul className="entryList">
        {listItems}
      </ul>
    );
  },

  _getSortedEntries: function() {
    var entries = _.values(this.props.entries || {});

    entries.sort(function(a, b) {
      if (a.ts === b.ts) {
        return 0;
      } else if (a.ts < b.ts) {
        return 1;
      } else {
        return -1;
      }
    });

    return entries;
  },

  _onSelect: function(e) {
    if (this.props.onSelect) {
      this.props.onSelect(e.currentTarget.dataset.id);
    }
  },

});

