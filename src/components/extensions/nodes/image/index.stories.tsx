import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", "Image");

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `![Minion](https://octodex.github.com/images/minion.png)

![Stormtroopocat](https://octodex.github.com/images/stormtroopocat.jpg "The Stormtroopocat")`,
};
