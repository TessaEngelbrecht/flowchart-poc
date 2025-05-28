import React    from "react";
import template from "./Flowchart.jsx";

class Flowchart extends React.Component {
  render() {
    return template.call(this);
  }
}

export default Flowchart;
