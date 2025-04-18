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
import { Accordion, AccordionTab, AccordionTabChangeEvent } from 'primereact/accordion';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown, DropdownChangeEvent } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { OverlayPanel } from 'primereact/overlaypanel';
import { classNames } from 'primereact/utils';
import React, { FocusEventHandler, KeyboardEvent, KeyboardEventHandler, ReactNode } from 'react';
import { CONFIG_BYTES_PER_MAU_CHOICES, CONFIG_GROUPS_PER_ROW_CHOICES, CONFIG_MAUS_PER_GROUP_CHOICES, ENDIANNESS_CHOICES, PERIODIC_REFRESH_CHOICES } from '../../common/manifest';
import { validateCount, validateMemoryReference, validateOffset } from '../../common/memory';
import { MemoryOptions, ReadMemoryArguments, Session, SessionContext } from '../../common/messaging';
import { tryToNumber } from '../../common/typescript';
import { TableRenderOptions } from '../columns/column-contribution-service';
import { DEFAULT_MEMORY_DISPLAY_CONFIGURATION } from '../memory-webview-view';
import { AddressPaddingOptions, DEFAULT_READ_ARGUMENTS, MemoryState, SerializedTableRenderOptions } from '../utils/view-types';
import { createOverlayMoreActionsVscodeContext, createSectionVscodeContext } from '../vscode-context/vscode-contexts';
import { MultiSelectBar } from './multi-select';

export interface OptionsWidgetProps
    extends Omit<TableRenderOptions, 'scrollingBehavior' | 'effectiveAddressLength'> {
    sessions: Session[]
    updateSession: (sessionId: string) => void;
    sessionContext: SessionContext;
    configuredReadArguments: Required<ReadMemoryArguments>;
    activeReadArguments: Required<ReadMemoryArguments>;
    title: string;
    settingsContributionMessage?: string;
    updateRenderOptions: (options: Partial<SerializedTableRenderOptions>) => void;
    updateTitle: (title: string) => void;
    updateMemoryState: (state: Partial<MemoryState>) => void;
    fetchMemory(partialOptions?: MemoryOptions): Promise<void>
    toggleColumn(id: string, isVisible: boolean): void;
    toggleFrozen: () => void;
    isFrozen: boolean;
    storeMemory(): void;
    applyMemory(): void;
}

interface OptionsWidgetState {
    isTitleEditing: boolean;
    showColumnsOptions: boolean;
    showMemoryOptions: boolean;
    showAddressOptions: boolean;
    showRefreshOptions: boolean;
}

const enum InputId {
    Address = 'address',
    Offset = 'offset',
    Length = 'length',
    BytesPerMau = 'mau-size',
    MausPerGroup = 'maus-per-group',
    GroupsPerRow = 'groups-per-row',
    EndiannessId = 'endianness',
    AddressPadding = 'address-padding',
    AddressRadix = 'address-radix',
    ShowRadixPrefix = 'show-radix-prefix',
    RefreshOnStop = 'refresh-on-stop',
    PeriodicRefresh = 'periodic-refresh',
    PeriodicRefreshInterval = 'periodic-refresh-interval',
    SessionSelect = 'session-select'
}

interface OptionsForm {
    address: string;
    offset: string;
    count: string;
}

export class OptionsWidget extends React.Component<OptionsWidgetProps, OptionsWidgetState> {
    protected formConfig: FormikConfig<OptionsForm>;
    protected extendedOptions = React.createRef<OverlayPanel>();
    protected labelEditInput = React.createRef<HTMLInputElement>();
    protected refreshRateInput = React.createRef<InputNumber>();
    protected coreOptionsDiv = React.createRef<HTMLDivElement>();
    protected optionsMenuContext = createSectionVscodeContext('optionsWidget');
    protected advancedOptionsContext = createSectionVscodeContext('advancedOptionsOverlay');
    protected moreActionsOverlayMenuContext = createOverlayMoreActionsVscodeContext();
    protected advancedOptionsSections: { key: keyof OptionsWidgetState, index: number }[] = [
        { key: 'showColumnsOptions', index: 0 },
        { key: 'showMemoryOptions', index: 1 },
        { key: 'showAddressOptions', index: 2 },
        { key: 'showRefreshOptions', index: 3 }
    ];

    protected get optionsFormValues(): OptionsForm {
        return {
            address: this.props.configuredReadArguments.memoryReference,
            offset: this.props.configuredReadArguments.offset.toString(),
            count: this.props.configuredReadArguments.count.toString(),
        };
    }

    constructor(props: OptionsWidgetProps) {
        super(props);

        this.formConfig = {
            initialValues: this.optionsFormValues,
            enableReinitialize: true,
            validate: this.validate,
            onSubmit: () => this.props.fetchMemory(this.props.configuredReadArguments),
        };
        this.state = {
            isTitleEditing: false,
            showColumnsOptions: false,
            showMemoryOptions: true,
            showAddressOptions: false,
            showRefreshOptions: true
        };
    }

    protected validate = (values: OptionsForm) => {
        const errors: FormikErrors<OptionsForm> = {};
        const addressError = values.address.trim().length === 0 ? 'Required' : validateMemoryReference(values.address.trim());
        if (addressError) {
            errors.address = addressError;
        }
        const offsetError = values.offset.trim().length === 0 ? 'Required' : validateOffset(values.offset);
        if (offsetError) {
            errors.offset = offsetError;
        }
        const countError = values.count.trim().length === 0 ? 'Required' : validateCount(values.count);
        if (countError) {
            errors.count = countError;
        }
        return errors;
    };

    componentDidUpdate(prevProps: Readonly<OptionsWidgetProps>, prevState: Readonly<OptionsWidgetState>): void {
        if (!prevState.isTitleEditing && this.state.isTitleEditing) {
            this.labelEditInput.current?.focus();
            this.labelEditInput.current?.select();
        }
        if (prevProps.activeReadArguments === DEFAULT_READ_ARGUMENTS) {
            this.formConfig.initialErrors = this.validate(this.optionsFormValues);
        }
    }

    override render(): React.ReactNode {
        this.formConfig.initialValues = this.optionsFormValues;
        const isLabelEditing = this.state.isTitleEditing;
        const isFrozen = this.props.isFrozen;
        const readDisabled = isFrozen || !this.props.sessionContext.canRead;
        const freezeContentToggleTitle = isFrozen ? 'Unfreeze Memory View' : 'Freeze Memory View';
        const activeMemoryReadArgumentHint = (userValue: string | number, memoryValue: string | number): ReactNode | undefined => {
            if (userValue === memoryValue || this.props.activeReadArguments === DEFAULT_READ_ARGUMENTS) {
                return undefined;
            }
            return <small className="form-options-memory-read-argument-hint">Actual: {memoryValue}</small>;

        };

        const sessionSelector = this.props.sessions.length <= 1 ? undefined :
            <span className='pm-top-label form-textfield'>
                <label htmlFor={InputId.SessionSelect} className={`p-inputtext-label ${readDisabled ? 'p-disabled' : ''}`}>
                    Debug Session
                </label>
                <Dropdown
                    id={InputId.SessionSelect}
                    className='advanced-options-session'
                    title='Debug Session'
                    aria-label='Debug Session'
                    disabled={readDisabled}
                    options={this.props.sessions.map(session => ({ label: session.name, value: session.id }))}
                    value={this.props.sessionContext.sessionId}
                    onChange={this.handleSessionDropdownChange}
                />
            </span>;

        return (
            <div className='memory-options-widget px-4' {...this.optionsMenuContext}>
                <div className='title-container'>
                    <Button
                        type='button'
                        className={`freeze-content-toggle ${isFrozen ? 'toggled' : ''}`}
                        icon={'codicon codicon-' + (isFrozen ? 'lock' : 'unlock')}
                        onClick={this.props.toggleFrozen}
                        title={freezeContentToggleTitle}
                        aria-label={freezeContentToggleTitle}
                        rounded
                        aria-haspopup
                    />
                    <InputText
                        ref={this.labelEditInput}
                        type='text'
                        onKeyDown={this.handleTitleEditingKeyDown}
                        onBlur={this.confirmEditedTitle}
                        style={{ display: isLabelEditing ? 'block' : 'none' }}
                    />
                    {!isLabelEditing && (
                        <h1 onDoubleClick={this.enableTitleEditing}>{this.props.title}</h1>
                    )}
                    {!isLabelEditing && (
                        <>
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
                            <Button
                                type='button'
                                className='store-file-button'
                                icon='codicon codicon-save'
                                onClick={this.props.storeMemory}
                                disabled={!this.props.sessionContext.canWrite}
                                title='Store Memory as File'
                                aria-label='Store Memory as File'
                                rounded
                                aria-haspopup
                            />
                            <Button
                                type='button'
                                className='apply-file-button'
                                icon='codicon codicon-folder-opened'
                                onClick={this.props.applyMemory}
                                disabled={!this.props.sessionContext.canRead}
                                title='Apply Memory from File'
                                aria-label='Apply Memory from File'
                                rounded
                                aria-haspopup
                            />
                        </>
                    )}
                </div>
                <div className='core-options' ref={this.coreOptionsDiv}>
                    <Formik {...this.formConfig}>
                        {formik => (
                            <form onSubmit={formik.handleSubmit} className='form-options'>
                                <span className={'pm-top-label form-textfield form-texfield-long'}>
                                    <label htmlFor={InputId.Address} className={`p-inputtext-label ${readDisabled ? 'p-disabled' : ''}`} >
                                        Address
                                    </label>
                                    <InputText
                                        id={InputId.Address}
                                        className={classNames({ 'p-invalid': formik.errors.address })}
                                        {...formik.getFieldProps('address')}
                                        onKeyDown={this.handleKeyDown}
                                        onBlur={ev => this.doHandleBlur(ev, formik)}
                                        disabled={readDisabled}
                                    />
                                    {formik.errors.address ?
                                        (<small className='p-invalid'>
                                            {formik.errors.address}
                                        </small>)
                                        : undefined}
                                    {activeMemoryReadArgumentHint(this.props.configuredReadArguments.memoryReference, this.props.activeReadArguments.memoryReference)}
                                </span>
                                <span className='pm-top-label form-textfield'>
                                    <label htmlFor={InputId.Offset} className={`p-inputtext-label ${readDisabled ? 'p-disabled' : ''}`}>
                                        Offset
                                    </label>
                                    <InputText
                                        id={InputId.Offset}
                                        className={classNames({ 'p-invalid': formik.errors.offset })}
                                        {...formik.getFieldProps('offset')}
                                        onKeyDown={this.handleKeyDown}
                                        onBlur={ev => this.doHandleBlur(ev, formik)}
                                        disabled={readDisabled}
                                    />
                                    {formik.errors.offset ?
                                        (<small className='p-invalid'>
                                            {formik.errors.offset}
                                        </small>)
                                        : undefined}
                                    {activeMemoryReadArgumentHint(this.props.configuredReadArguments.offset, this.props.activeReadArguments.offset)}
                                </span>
                                <span className='pm-top-label form-textfield'>
                                    <label htmlFor={InputId.Length} className={`p-inputtext-label ${readDisabled ? 'p-disabled' : ''}`}>
                                        Length
                                    </label>
                                    <InputText
                                        id={InputId.Length}
                                        className={classNames({ 'p-invalid': formik.errors.count })}
                                        {...formik.getFieldProps('count')}
                                        onKeyDown={this.handleKeyDown}
                                        onBlur={ev => this.doHandleBlur(ev, formik)}
                                        disabled={readDisabled}
                                    />
                                    {formik.errors.count ?
                                        (<small className='p-invalid'>
                                            {formik.errors.count}
                                        </small>)
                                        : undefined}
                                    {activeMemoryReadArgumentHint(this.props.configuredReadArguments.count, this.props.activeReadArguments.count)}
                                </span>
                                <Button type='submit' disabled={!formik.isValid || readDisabled}>
                                    Go
                                </Button>
                                {sessionSelector}
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
                            </form>
                        )}
                    </Formik>
                    <OverlayPanel
                        appendTo={this.coreOptionsDiv.current}
                        className='advanced-options-panel'
                        ref={this.extendedOptions}
                        {...this.advancedOptionsContext}>
                        <h2 className='advanced-options-header'>Advanced Options</h2>
                        {this.props.settingsContributionMessage && (
                            <p className='settings-contribution-message'>{this.props.settingsContributionMessage}</p>
                        )}
                        <Button
                            {...this.moreActionsOverlayMenuContext}
                            icon='codicon codicon-ellipsis'
                            className='more-actions-overlay-icon'
                            onClick={this.handleMoreActionsButtonInOverlay}
                            title='More Actions...'
                            rounded
                            aria-label='More Actions...'
                            aria-haspopup
                        />
                        <Accordion
                            multiple
                            activeIndex={this.getActiveAdvancedOptionSectionIndices()}
                            className='advanced-options-accordion'
                            onTabChange={this.onAdvancedOptionsTabChange}
                        >
                            {!!this.props.columnOptions.length && (
                                <AccordionTab header='Columns'>
                                    <div className='advanced-options-content mt-2'>
                                        <MultiSelectBar
                                            id='column-select'
                                            classNames='advanced-options-content'
                                            items={this.props.columnOptions
                                                .filter(({ configurable }) => configurable)
                                                .map(column => ({
                                                    id: column.contribution.id,
                                                    label: column.contribution.label,
                                                    checked: column.active,
                                                }))}
                                            onSelectionChanged={this.handleColumnActivationChange}
                                        />
                                    </div>
                                </AccordionTab>
                            )}

                            <AccordionTab header='Memory Format'>
                                <div className='advanced-options-content'>
                                    <label
                                        htmlFor={InputId.BytesPerMau}
                                        className='advanced-options-label'
                                    >
                                        Bytes per <abbr className='no-text-decoration' title='Minimum Addressable Unit'>MAU</abbr>
                                    </label>
                                    <Dropdown
                                        id={InputId.BytesPerMau}
                                        value={this.props.bytesPerMau}
                                        onChange={this.handleAdvancedOptionsDropdownChange}
                                        options={[...CONFIG_BYTES_PER_MAU_CHOICES]}
                                        className='advanced-options-dropdown' />

                                    <label
                                        htmlFor={InputId.MausPerGroup}
                                        className='advanced-options-label'
                                    >
                                        <abbr className='no-text-decoration' title='Minimum Addressable Units'>MAUs</abbr> per Group
                                    </label>
                                    <Dropdown
                                        id={InputId.MausPerGroup}
                                        value={this.props.mausPerGroup}
                                        onChange={this.handleAdvancedOptionsDropdownChange}
                                        options={[...CONFIG_MAUS_PER_GROUP_CHOICES]}
                                        className='advanced-options-dropdown' />
                                    <label
                                        htmlFor={InputId.GroupsPerRow}
                                        className='advanced-options-label'
                                    >
                                        Groups per Row
                                    </label>
                                    <Dropdown
                                        id={InputId.GroupsPerRow}
                                        value={this.props.groupsPerRow}
                                        onChange={this.handleAdvancedOptionsDropdownChange}
                                        options={[...CONFIG_GROUPS_PER_ROW_CHOICES]}
                                        className='advanced-options-dropdown' />

                                    <label
                                        htmlFor={InputId.EndiannessId}
                                        className='advanced-options-label'
                                    >
                                        Group Endianness
                                    </label>
                                    <Dropdown
                                        id={InputId.EndiannessId}
                                        value={this.props.endianness}
                                        onChange={this.handleAdvancedOptionsDropdownChange}
                                        options={[...ENDIANNESS_CHOICES]}
                                        className='advanced-options-dropdown' />
                                </div>
                            </AccordionTab>

                            <AccordionTab header='Address Format'>
                                <div className='advanced-options-content'>
                                    <label
                                        htmlFor={InputId.AddressPadding}
                                        className='advanced-options-label'
                                    >
                                        Padding
                                    </label>
                                    <Dropdown
                                        id={InputId.AddressPadding}
                                        value={this.props.addressPadding}
                                        onChange={this.handleAdvancedOptionsDropdownChange}
                                        options={Object.entries(AddressPaddingOptions).map(([label, value]) => ({ label, value }))}
                                        className="advanced-options-dropdown" />

                                    <label
                                        htmlFor={InputId.AddressRadix}
                                        className='advanced-options-label'
                                    >
                                        Format (Radix)
                                    </label>
                                    <Dropdown
                                        id={InputId.AddressRadix}
                                        value={Number(this.props.addressRadix)}
                                        onChange={this.handleAdvancedOptionsDropdownChange}
                                        options={[
                                            { label: '2 - Binary', value: 2 },
                                            { label: '8 - Octal', value: 8 },
                                            { label: '10 - Decimal', value: 10 },
                                            { label: '16 - Hexadecimal', value: 16 }
                                        ]}
                                        className="advanced-options-dropdown" />
                                    <div className='flex align-items-center mt-2'>
                                        <Checkbox
                                            id={InputId.ShowRadixPrefix}
                                            onChange={this.handleAdvancedOptionsDropdownChange}
                                            checked={!!this.props.showRadixPrefix}
                                        />
                                        <label htmlFor={InputId.ShowRadixPrefix} className='ml-2'>Display Radix Prefix</label>
                                    </div>
                                </div>
                            </AccordionTab>

                            <AccordionTab header='Refresh Options'>
                                <div className='advanced-options-content mt-2 mb-0'>
                                    <div className='flex align-items-center'>
                                        <Checkbox
                                            id={InputId.RefreshOnStop}
                                            onChange={this.handleAdvancedOptionsDropdownChange}
                                            checked={this.props.refreshOnStop === 'on'}
                                        />
                                        <label htmlFor={InputId.ShowRadixPrefix} className='ml-2'>Refresh On Stop</label>
                                    </div>

                                    <label htmlFor={InputId.PeriodicRefresh} className='advanced-options-label mt-2'>Periodic Refresh</label>
                                    <Dropdown
                                        id={InputId.PeriodicRefresh}
                                        value={this.props.periodicRefresh}
                                        onChange={this.handleAdvancedOptionsDropdownChange}
                                        options={[...PERIODIC_REFRESH_CHOICES]}
                                        className="advanced-options-dropdown" />

                                    <div className='flex align-items-center mt-2'>
                                        <InputNumber
                                            id={InputId.PeriodicRefreshInterval}
                                            ref={this.refreshRateInput}
                                            disabled={this.props.periodicRefresh === 'off'}
                                            value={this.props.periodicRefreshInterval}
                                            placeholder='Interval in ms'
                                            inputClassName='advanced-options-input'
                                            min={500}
                                            step={250}
                                            maxFractionDigits={0}
                                            useGrouping={false}
                                            onBlur={this.handlePeriodicRefreshIntervalChange}
                                            onKeyDown={this.handlePeriodicRefreshIntervalChange} />
                                        <label htmlFor={InputId.PeriodicRefreshInterval} className='ml-2'>ms</label>
                                    </div>
                                </div>
                            </AccordionTab>

                        </Accordion>
                    </OverlayPanel>
                </div >
            </div >
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
        if (event.key === 'Enter') {
            const id = event.currentTarget.id as InputId;
            const value = event.currentTarget.value;

            this.updateOptions(id, value);
        }
    }

    protected handleMoreActionsButtonInOverlay: (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>) => void = e => this.triggerContextMenu(e);
    protected triggerContextMenu(event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>): void {
        event.target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: event.clientX, clientY: event.clientY }));
    }

    protected updateOptions(id: InputId, value: string): void {
        switch (id) {
            case InputId.Address:
                this.props.updateMemoryState({
                    configuredReadArguments: {
                        ...this.props.configuredReadArguments,
                        memoryReference: value.trim(),
                    }
                });
                break;
            case InputId.Offset:
                if (!!value && !Number.isNaN(value)) {
                    this.props.updateMemoryState({
                        configuredReadArguments: {
                            ...this.props.configuredReadArguments,
                            offset: Number(value),
                        }
                    });
                }
                break;
            case InputId.Length:
                if (!!value && !Number.isNaN(value)) {
                    this.props.updateMemoryState({
                        configuredReadArguments: {
                            ...this.props.configuredReadArguments,
                            count: Number(value),
                        }
                    });
                }
                break;
            default: {
                throw new Error(`${id} can not be handled. Did you call the correct method?`);
            }
        }
    }

    protected handleSessionDropdownChange = (event: DropdownChangeEvent) => this.props.updateSession(event.target.value);

    protected handleAdvancedOptionsDropdownChange: (event: DropdownChangeEvent) => void = e => this.doHandleAdvancedOptionsDropdownChange(e);
    protected doHandleAdvancedOptionsDropdownChange(event: DropdownChangeEvent): void {
        const id = event.target.id as InputId;
        const value = event.target.value;
        switch (id) {
            case InputId.BytesPerMau:
                this.props.updateRenderOptions({ bytesPerMau: Number(value) });
                break;
            case InputId.MausPerGroup:
                this.props.updateRenderOptions({ mausPerGroup: Number(value) });
                break;
            case InputId.GroupsPerRow:
                this.props.updateRenderOptions({ groupsPerRow: tryToNumber(value) ?? value });
                break;
            case InputId.EndiannessId:
                this.props.updateRenderOptions({ endianness: value });
                break;
            case InputId.AddressPadding:
                this.props.updateRenderOptions({ addressPadding: value });
                break;
            case InputId.AddressRadix:
                this.props.updateRenderOptions({ addressRadix: Number(value) });
                break;
            case InputId.ShowRadixPrefix:
                this.props.updateRenderOptions({ showRadixPrefix: !!event.target.checked });
                break;
            case InputId.RefreshOnStop:
                this.props.updateRenderOptions({ refreshOnStop: !!event.target.checked ? 'on' : 'off' });
                break;
            case InputId.PeriodicRefresh:
                this.props.updateRenderOptions({ periodicRefresh: value });
                break;
            default: {
                throw new Error(`${id} can not be handled. Did you call the correct method?`);
            }
        }
    }

    protected handleColumnActivationChange: (labelSelected: string, newSelectionState: boolean) => void = (label, state) => this.doHandleColumnActivationChange(label, state);
    doHandleColumnActivationChange(label: string, isVisible: boolean): void {
        const columnState = this.props.columnOptions.find(columnStatus => columnStatus.contribution.label.toLowerCase() === label.toLowerCase());
        const columnId = columnState?.contribution.id;
        if (columnId) {
            this.props.toggleColumn(columnId, isVisible);
        }
    }

    protected handlePeriodicRefreshIntervalChange: (event: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => void =
        event => this.doHandlePeriodicRefreshIntervalChange(event);
    doHandlePeriodicRefreshIntervalChange(event: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>): void {
        if (!('key' in event) || event.key === 'Enter') {
            const periodicRefreshInterval = tryToNumber(event.currentTarget.value) ?? DEFAULT_MEMORY_DISPLAY_CONFIGURATION.periodicRefreshInterval;
            this.props.updateRenderOptions({ periodicRefreshInterval });
        }
    }

    protected enableTitleEditing = () => this.doEnableTitleEditing();
    protected doEnableTitleEditing(): void {
        if (this.labelEditInput.current) {
            this.labelEditInput.current.value = this.props.title;
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
            this.props.updateTitle(this.labelEditInput.current.value.trim());
            this.disableTitleEditing();
        }
    }

    public showAdvancedOptions(): void {
        if (this.extendedOptions.current && this.coreOptionsDiv.current) {
            if (!this.extendedOptions.current.getElement()) {
                this.coreOptionsDiv.current.querySelector<HTMLButtonElement>('.advanced-options-toggle')?.click();
            }
        }
    }

    protected getActiveAdvancedOptionSectionIndices(): number[] {
        return this.advancedOptionsSections
            .filter(option => this.state[option.key])
            .map(option => option.index);
    }

    protected onAdvancedOptionsTabChange: (event: AccordionTabChangeEvent) => void = event => this.doAdvancedOptionsTabChange(event);
    protected doAdvancedOptionsTabChange(event: AccordionTabChangeEvent): void {
        const activeIndices = Array.isArray(event.index) ? event.index : [event.index];
        const newState = this.advancedOptionsSections.reduce((acc, option) => {
            acc[option.key] = activeIndices.includes(option.index);
            return acc;
        }, {} as OptionsWidgetState);
        this.setState(newState);
    }

}
