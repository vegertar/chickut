import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", "Code");

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `    // Some comments
    line 1 of code
    line 2 of code
    line 3 of code

setup a counter

    var x = getCounter();
    const id = setInterval(() => ++x, 1000);
    () => {
        clearInterval(id);
        setCounter(x);
    }

setup extra indicators

    const y = new Date().toLocaleString();

    let counter = 0;

    function setCounter(n) {
        counter = n;
    }

    function getCounter() {
        return counter;
    }

js

    \`id: \${id}  startup: \${y}  counter: \${x}\`

React

    React.createElement(React.Fragment, null, "id: ", id, "  startup: ", y, "  counter: ", x)

jsx

    <>id: {id}  startup: {y}  counter: {x}</>

import

    import { h, Component, render } from 'https://unpkg.com/preact?module'`,
};
