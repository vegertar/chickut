import Extension from "./index";
import { meta, template } from "../../index.stories";
import Base from "../../nodes/base";
import Link from "../../marks/link";

export default meta("Plugins", Extension, [Base, Link]);

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `<http://foo.bar.baz>`,
};
