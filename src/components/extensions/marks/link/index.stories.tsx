import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Marks", "Link");

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `[pica](https://nodeca.github.io/pica/demo/ "pica demo")

[babelfish](https://github.com/nodeca/babelfish/)`,
};
