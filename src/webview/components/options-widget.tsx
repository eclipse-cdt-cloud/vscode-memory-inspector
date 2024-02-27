/********************************************************************************
 * Copyright (C) 2023 Ericsson, Arm and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { Formik, FormikConfig, FormikErrors, FormikProps } from 'formik';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown, DropdownChangeEvent } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { OverlayPanel } from 'primereact/overlaypanel';
import { classNames } from 'primereact/utils';
import React, { FocusEventHandler, KeyboardEvent, KeyboardEventHandler, MouseEventHandler } from 'react';
import {
    Endianness
} from '../utils/view-types';
import { MemoryAppContext } from './memory-app-provider';
import { MultiSelectWithLabel } from './multi-select';

export interface OptionsWidgetProps {
    endianness: Endianness;
}

interface OptionsWidgetState {
    isTitleEditing: boolean;
}

const enum InputId {
    Address = 'address',
    Offset = 'offset',
    Length = 'length',
    BytesPerWord = 'word-size',
    WordsPerGroup = 'words-per-group',
    GroupsPerRow = 'groups-per-row',
    AddressRadix = 'address-radix',
    ShowRadixPrefix = 'show-radix-prefix',
}

interface OptionsForm {
    address: string;
    offset: string;
    count: string;
}

const allowedBytesPerWord = [1, 2, 4, 8, 16];
const allowedWordsPerGroup = [1, 2, 4, 8, 16];
const allowedGroupsPerRow = [1, 2, 4, 8, 16, 32];

export class OptionsWidget extends React.Component<OptionsWidgetProps, OptionsWidgetState> {
    static contextType = MemoryAppContext;
    declare context: MemoryAppContext;

    protected formConfig: FormikConfig<OptionsForm>;
    protected extendedOptions = React.createRef<OverlayPanel>();
    protected labelEditInput = React.createRef<HTMLInputElement>();

    protected get optionsFormValues(): OptionsForm {
        return {
            address: this.context.memoryReference,
            offset: this.context.offset.toString(),
            count: this.context.count.toString(),
        };
    }

    constructor(props: OptionsWidgetProps) {
        super(props);
        this.state = { isTitleEditing: false };
        this.formConfig = {
            initialValues: {
                address: '',
                offset: '',
                count: '',
            },
            enableReinitialize: true,
            validate: this.validate,
            onSubmit: () => {
                this.context.refreshMemory();
            },
        };
    }

    protected validate = (values: OptionsForm) => {
        const errors: FormikErrors<OptionsForm> = {};

        if (values.address.trim().length === 0) {
            errors.address = 'Required';
        } else {
            const address = +values.address;
            if (!isNaN(address) && address < 0) {
                errors.address = 'Value needs to be >= 0';
            }
        }

        if (values.offset.trim().length === 0) {
            errors.offset = 'Required';
        } else {
            const offset = +values.offset;
            if (isNaN(offset)) {
                errors.offset = 'No number provided';
            }
        }

        if (values.count.trim().length === 0) {
            errors.count = 'Required';
        } else {
            const count = +values.count;
            if (isNaN(count)) {
                errors.count = 'No number provided';
            } else if (count <= 0) {
                errors.count = 'Value needs to be > 0';
            }
        }

        return errors;
    };

    componentDidUpdate(_: Readonly<OptionsWidgetProps>, prevState: Readonly<OptionsWidgetState>): void {
        if (!prevState.isTitleEditing && this.state.isTitleEditing) {
            this.labelEditInput.current?.focus();
            this.labelEditInput.current?.select();
        }
    }

    override render(): React.ReactNode {
        this.formConfig.initialValues = this.optionsFormValues;
        const isLabelEditing = this.state.isTitleEditing;

        return (
            <div className='memory-options-widget px-4'>
                <div className='title-container'>
                    <InputText
                        ref={this.labelEditInput}
                        type='text'
                        onKeyDown={this.handleTitleEditingKeyDown}
                        onBlur={this.confirmEditedTitle}
                        style={{ display: isLabelEditing ? 'block' : 'none' }}
                    />
                    {!isLabelEditing && (
                        <h1 onDoubleClick={this.enableTitleEditing}>{this.context.title}</h1>
                    )}
                    {!isLabelEditing && (
                        <Button
                            type='button'
                            className='edit-label-toggle'
                            icon='codicon codicon-edit'
                            onClick={this.enableTitleEditing}
                            title='Edit view title'
                            aria-label='Edit view title'
                            rounded
                            aria-haspopup
                        />
                    )}
                </div>
                <div className='core-options py-2'>
                    <Formik {...this.formConfig}>
                        {formik => (
                            <form onSubmit={formik.handleSubmit} className='form-options'>
                                <span className='pm-top-label form-texfield-long'>
                                    <label htmlFor={InputId.Address} className='p-inputtext-label'>
                                        Address
                                    </label>
                                    <InputText
                                        id={InputId.Address}
                                        className={classNames({ 'p-invalid': formik.errors.address })}
                                        {...formik.getFieldProps('address')}
                                        onKeyDown={this.handleKeyDown}
                                        onBlur={ev => this.doHandleBlur(ev, formik)}
                                    />
                                    {formik.errors.address ?
                                        (<small className='p-invalid'>
                                            {formik.errors.address}
                                        </small>)
                                        : undefined}
                                </span>
                                <span className='pm-top-label form-textfield'>
                                    <label htmlFor={InputId.Offset} className='p-inputtext-label'>
                                        Offset
                                    </label>
                                    <InputText
                                        id={InputId.Offset}
                                        className={classNames({ 'p-invalid': formik.errors.offset })}
                                        {...formik.getFieldProps('offset')}
                                        onKeyDown={this.handleKeyDown}
                                        onBlur={ev => this.doHandleBlur(ev, formik)}
                                    />
                                    {formik.errors.offset ?
                                        (<small className='p-invalid'>
                                            {formik.errors.offset}
                                        </small>)
                                        : undefined}
                                </span>
                                <span className='pm-top-label form-textfield'>
                                    <label htmlFor={InputId.Length} className='p-inputtext-label'>
                                        Length
                                    </label>
                                    <InputText
                                        id={InputId.Length}
                                        className={classNames({ 'p-invalid': formik.errors.count })}
                                        {...formik.getFieldProps('count')}
                                        onKeyDown={this.handleKeyDown}
                                        onBlur={ev => this.doHandleBlur(ev, formik)}
                                    />
                                    {formik.errors.count ?
                                        (<small className='p-invalid'>
                                            {formik.errors.count}
                                        </small>)
                                        : undefined}
                                </span>
                                <Button type='submit' disabled={!formik.isValid}>
                                    Go
                                </Button>
                            </form>
                        )}
                    </Formik>
                    <Button
                        className='advanced-options-toggle'
                        icon='codicon codicon-gear'
                        onClick={event =>
                            this.extendedOptions?.current?.toggle(event)
                        }
                        type='button'
                        title='Advanced Display Options'
                        rounded
                        aria-label='Advanced Display Options'
                        aria-haspopup
                    ></Button>
                    <OverlayPanel ref={this.extendedOptions}>
                        <Button
                            icon='codicon codicon-discard'
                            className='reset-advanced-options-icon'
                            onClick={this.handleResetAdvancedOptions}
                            title='Reset to Defaults'
                            rounded
                            aria-label='Reset to Defaults'
                            aria-haspopup
                        />
                        <div className='advanced-options-content'>
                            {!!this.context.columns.length && (
                                <MultiSelectWithLabel
                                    id='column-select'
                                    label='Columns'
                                    items={this.context.columns
                                        .filter(({ configurable }) => configurable)
                                        .map(column => ({
                                            id: column.contribution.id,
                                            label: column.contribution.label,
                                            checked: column.active,
                                        }))}
                                    onSelectionChanged={this.handleColumnActivationChange}
                                />
                            )}

                            <h2>Memory Format</h2>
                            <label
                                htmlFor={InputId.BytesPerWord}
                                className='advanced-options-label mt-1'
                            >
                                Bytes per Word
                            </label>
                            <Dropdown
                                id={InputId.BytesPerWord}
                                value={this.context.bytesPerWord}
                                onChange={this.handleAdvancedOptionsDropdownChange}
                                options={allowedBytesPerWord}
                                className='advanced-options-dropdown' />

                            <label
                                htmlFor={InputId.WordsPerGroup}
                                className='advanced-options-label mt-1'
                            >
                                Words per Group
                            </label>
                            <Dropdown
                                id={InputId.WordsPerGroup}
                                value={this.context.wordsPerGroup}
                                onChange={this.handleAdvancedOptionsDropdownChange}
                                options={allowedWordsPerGroup}
                                className='advanced-options-dropdown' />
                            <label
                                htmlFor={InputId.GroupsPerRow}
                                className='advanced-options-label'
                            >
                                Groups per Row
                            </label>
                            <Dropdown
                                id={InputId.GroupsPerRow}
                                value={this.context.groupsPerRow}
                                onChange={this.handleAdvancedOptionsDropdownChange}
                                options={allowedGroupsPerRow}
                                className='advanced-options-dropdown' />

                            <h2>Address Format</h2>
                            <label
                                htmlFor={InputId.AddressRadix}
                                className='advanced-options-label'
                            >
                                Format (Radix)
                            </label>
                            <Dropdown
                                id={InputId.AddressRadix}
                                value={Number(this.context.addressRadix)}
                                onChange={this.handleAdvancedOptionsDropdownChange}
                                options={[
                                    { label: '2 - Binary', value: 2 },
                                    { label: '8 - Octal', value: 8 },
                                    { label: '10 - Decimal', value: 10 },
                                    { label: '16 - Hexadecimal', value: 16 }
                                ]}
                                className="advanced-options-dropdown" />

                            <div className='flex align-items-center'>
                                <Checkbox
                                    id={InputId.ShowRadixPrefix}
                                    onChange={this.handleAdvancedOptionsDropdownChange}
                                    checked={!!this.context.showRadixPrefix}
                                />
                                <label htmlFor={InputId.ShowRadixPrefix} className='ml-2'>Display Radix Prefix</label>
                            </div>
                        </div>
                    </OverlayPanel>
                </div>
            </div>
        );
    }

    protected doHandleBlur(
        ev: React.FocusEvent<HTMLInputElement>,
        formik: FormikProps<OptionsForm>
    ): void {
        formik.handleBlur(ev);
        const id = ev.currentTarget.id as InputId;
        const value = ev.currentTarget.value;

        this.updateOptions(id, value);
    }

    protected handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void = e => this.doHandleKeyDown(e);
    protected doHandleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
        if (event.code === 'Enter') {
            const id = event.currentTarget.id as InputId;
            const value = event.currentTarget.value;

            this.updateOptions(id, value);
        }
    }

    protected updateOptions(id: InputId, value: string): void {
        switch (id) {
            case InputId.Address:
                this.context.updateMemoryState({
                    memoryReference: value,
                });
                break;
            case InputId.Offset:
                if (!Number.isNaN(value)) {
                    this.context.updateMemoryState({
                        offset: Number(value),
                    });
                }
                break;
            case InputId.Length:
                if (!Number.isNaN(value)) {
                    this.context.updateMemoryState({
                        count: Number(value),
                    });
                }
                break;
            default: {
                throw new Error(`${id} can not be handled. Did you call the correct method?`);
            }
        }
    }

    protected handleAdvancedOptionsDropdownChange: (event: DropdownChangeEvent) => void = e => this.doHandleAdvancedOptionsDropdownChange(e);
    protected doHandleAdvancedOptionsDropdownChange(event: DropdownChangeEvent): void {
        const id = event.target.id as InputId;
        const value = event.target.value;
        switch (id) {
            case InputId.BytesPerWord:
                this.context.updateMemoryDisplayConfiguration({ bytesPerWord: Number(value) });
                break;
            case InputId.WordsPerGroup:
                this.context.updateMemoryDisplayConfiguration({ wordsPerGroup: Number(value) });
                break;
            case InputId.GroupsPerRow:
                this.context.updateMemoryDisplayConfiguration({ groupsPerRow: Number(value) });
                break;
            case InputId.AddressRadix:
                this.context.updateMemoryDisplayConfiguration({ addressRadix: Number(value) });
                break;
            case InputId.ShowRadixPrefix:
                this.context.updateMemoryDisplayConfiguration({ showRadixPrefix: !!event.target.checked });
                break;
            default: {
                throw new Error(`${id} can not be handled. Did you call the correct method?`);
            }
        }
    }

    protected handleColumnActivationChange: (labelSelected: string, newSelectionState: boolean) => void = (label, state) => this.doHandleColumnActivationChange(label, state);
    doHandleColumnActivationChange(label: string, isVisible: boolean): void {
        const columnState = this.context.columns.find(columnStatus => columnStatus.contribution.label.toLowerCase() === label.toLowerCase());
        const columnId = columnState?.contribution.id;
        if (columnId) {
            this.context.toggleColumn(columnId, isVisible);
        }
    }

    protected handleResetAdvancedOptions: MouseEventHandler<HTMLButtonElement> | undefined = () => this.context.resetMemoryDisplayConfiguration();

    protected enableTitleEditing = () => this.doEnableTitleEditing();
    protected doEnableTitleEditing(): void {
        if (this.labelEditInput.current) {
            this.labelEditInput.current.value = this.context.title;
        }
        this.setState({ isTitleEditing: true });
    }

    protected disableTitleEditing = () => this.doDisableTitleEditing();
    protected doDisableTitleEditing(): void {
        this.setState({ isTitleEditing: false });
    }

    protected handleTitleEditingKeyDown: KeyboardEventHandler<HTMLInputElement> | undefined = event => this.doHandleTitleEditingKeyDown(event);
    protected doHandleTitleEditingKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
        if (event.key === 'Enter' && this.labelEditInput.current) {
            this.doConfirmEditedTitle();
        } else if (event.key === 'Escape') {
            this.disableTitleEditing();
        }
    }

    protected confirmEditedTitle: FocusEventHandler<HTMLInputElement> | undefined = () => this.doConfirmEditedTitle();
    protected doConfirmEditedTitle(): void {
        if (this.state.isTitleEditing && this.labelEditInput.current) {
            this.context.updateTitle(this.labelEditInput.current.value.trim());
            this.disableTitleEditing();
        }
    }

}
