import Extension from "./index";
import { meta, template } from "../../index.stories";
import Heading from "../../nodes/heading";
import Base from "../../nodes/base";
import Emphasis from "../../marks/emphasis";

export default meta("Nodes", Extension, [Base, Heading, Emphasis]);

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `Foo *bar*
=========

Foo *bar*
---------`,
};
