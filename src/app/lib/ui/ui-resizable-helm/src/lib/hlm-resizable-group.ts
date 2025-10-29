import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BrnResizableGroup } from '@spartan-ng/brain/resizable';
import type { ClassValue } from 'clsx';
import { hlm } from '../../../ui-utils-helm/src';

@Component({
	selector: 'hlm-resizable-group',
	hostDirectives: [
		{
			directive: BrnResizableGroup,
			inputs: ['direction', 'layout'],
			outputs: ['dragEnd', 'dragStart', 'layoutChange'],
		},
	],
	template: `
		<ng-content />
	`,
	host: {
		'[class]': '_computedClass()',
	},
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HlmResizableGroup {
	public readonly userClass = input<ClassValue>('', { alias: 'class' });

	protected readonly _computedClass = computed(() =>
		hlm('group flex h-full w-full data-[panel-group-direction=vertical]:flex-col', this.userClass()),
	);
}
