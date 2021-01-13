import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Plugins", "Lheading", ["Base", "Heading", "Emphasis"]);

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `Foo *bar*
=========

Foo *bar*
---------`,
};
