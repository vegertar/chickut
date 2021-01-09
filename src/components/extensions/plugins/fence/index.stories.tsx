import Extension from "./index";
import { meta, template } from "../../index.stories";
import Base from "../../nodes/base";
import Code from "../../nodes/code";

export default meta("Nodes", Extension, [Base, Code]);

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `\`\`\`
  var foo = function (bar) {
    return bar++;
  };
  
  console.log(foo(5));
\`\`\``,
};
