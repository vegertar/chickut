import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Plugins", "Fence", ["Base", "Code"]);

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `\`\`\`js
  var foo = function (bar) {
    return bar++;
  };
  
  console.log(foo(5));
\`\`\``,
};
