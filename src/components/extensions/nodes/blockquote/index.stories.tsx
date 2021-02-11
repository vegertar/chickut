import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", "Blockquote");

const Template = template(Extension);

export const Example198 = Template.bind({});
Example198.args = {
  addon: ["Heading"],
  text: `> # Foo
> bar
> baz
> # Bar`,
};
